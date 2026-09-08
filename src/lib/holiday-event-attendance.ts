import "server-only";

import { BRAND } from "@/lib/brand";
import { getAppUrl } from "@/lib/email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateHolidayEventAttendanceConfirmed } from "@/lib/email/templates";
import {
  generateHolidayEventCertificatePdfBytes,
  uploadCertificatePdfToApimages,
} from "@/lib/holiday-event-certificate";
import {
  formatHolidayEventLabel,
  formatHolidayEventOccurrenceDisplay,
} from "@/lib/holiday-event-registration";
import { holidayEventPublicPath } from "@/lib/holiday-event-slug";
import { prisma } from "@/lib/prisma";

export type AttendanceMarkedBy =
  | { kind: "teacher"; teacherId: string; teacherName: string }
  | { kind: "staff"; userId: string; userName: string };

export type SetAttendanceResult =
  | {
      ok: true;
      registrationId: string;
      present: boolean;
      participantName: string;
      raffleNumber: number | null;
      certificateUrl: string | null;
      ticketRevoked: boolean;
    }
  | { ok: false; message: string };

const registrationInclude = {
  holiday: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      allowsRegistration: true,
      recurring: true,
      responsibleTeacherId: true,
      eventStartTime: true,
      eventEndTime: true,
    },
  },
  user: { select: { id: true, name: true, email: true } },
  raffleTicket: { select: { id: true, number: true } },
} as const;

/**
 * Emite o número de sorteio da inscrição (1 por pessoa presente).
 * Idempotente: cliques repetidos devolvem o mesmo número.
 */
export async function issueRaffleTicket(params: {
  registrationId: string;
  holidayId: string;
  occurrenceDate: string;
}): Promise<number> {
  const existing = await prisma.holidayEventRaffleTicket.findUnique({
    where: { registrationId: params.registrationId },
    select: { number: true },
  });
  if (existing) return existing.number;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const already = await tx.holidayEventRaffleTicket.findUnique({
          where: { registrationId: params.registrationId },
          select: { number: true },
        });
        if (already) return already.number;

        const last = await tx.holidayEventRaffleTicket.findFirst({
          where: { holidayId: params.holidayId, occurrenceDate: params.occurrenceDate },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;

        const created = await tx.holidayEventRaffleTicket.create({
          data: {
            registrationId: params.registrationId,
            holidayId: params.holidayId,
            occurrenceDate: params.occurrenceDate,
            number,
          },
          select: { number: true },
        });
        return created.number;
      });
    } catch {
      // Corrida no sequencial (unique holidayId+occurrenceDate+number): tenta o próximo número.
    }
  }
  throw new Error("Não foi possível emitir o número do sorteio.");
}

/** Remove o número quando a presença é desfeita; bloqueia se o número já foi sorteado. */
export async function revokeRaffleTicket(
  registrationId: string,
): Promise<{ ok: true; revoked: boolean } | { ok: false; message: string }> {
  const ticket = await prisma.holidayEventRaffleTicket.findUnique({
    where: { registrationId },
    select: { id: true, number: true, draws: { where: { status: "WINNER" }, select: { id: true } } },
  });
  if (!ticket) return { ok: true, revoked: false };

  if (ticket.draws.length > 0) {
    return {
      ok: false,
      message: `O número ${ticket.number} já foi sorteado. Cancele ou refaça o sorteio antes de desfazer a presença.`,
    };
  }

  await prisma.holidayEventRaffleTicket.delete({ where: { id: ticket.id } });
  return { ok: true, revoked: true };
}

async function ensureEventCertificate(params: {
  registrationId: string;
  participantName: string;
  eventName: string;
  occurrenceDate: string;
  eventStartTime: string | null;
  eventEndTime: string | null;
  responsibleTeacherName: string | null;
}): Promise<string | null> {
  try {
    const pdfBytes = await generateHolidayEventCertificatePdfBytes({
      participantName: params.participantName,
      eventName: params.eventName,
      occurrenceDate: params.occurrenceDate,
      eventStartTime: params.eventStartTime,
      eventEndTime: params.eventEndTime,
      responsibleTeacherName: params.responsibleTeacherName,
    });
    const safeDate = params.occurrenceDate.replaceAll("-", "");
    const participantSlug = params.participantName.trim().slice(0, 32).replaceAll(" ", "-");
    const up = await uploadCertificatePdfToApimages({
      pdfBytes,
      fileName: `certificado-evento-${safeDate}-${participantSlug}.pdf`,
    });
    await prisma.holidayEventRegistration.update({
      where: { id: params.registrationId },
      data: {
        certificateUrl: up.url,
        certificatePublicId: up.publicId,
        certificateFileName: up.fileName,
      },
    });
    return up.url;
  } catch {
    // Presença permanece marcada; o certificado pode ser gerado depois.
    return null;
  }
}

/**
 * Marca ou desfaz a presença em uma ocorrência de evento.
 * Ao confirmar presença, emite o número do sorteio e gera o certificado.
 */
export async function setHolidayEventAttendance(params: {
  registrationId: string;
  present: boolean;
  markedBy: AttendanceMarkedBy;
  /** Notifica o participante por e-mail com o número emitido. */
  notifyParticipant?: boolean;
}): Promise<SetAttendanceResult> {
  const reg = await prisma.holidayEventRegistration.findUnique({
    where: { id: params.registrationId },
    include: registrationInclude,
  });
  if (!reg) return { ok: false, message: "Inscrição não encontrada." };
  if (!reg.holiday.isActive || !reg.holiday.allowsRegistration) {
    return { ok: false, message: "Evento não encontrado." };
  }
  if (
    params.markedBy.kind === "teacher" &&
    reg.holiday.responsibleTeacherId !== params.markedBy.teacherId
  ) {
    return { ok: false, message: "Você não é o professor responsável por este evento." };
  }

  let ticketRevoked = false;
  if (!params.present) {
    const revoke = await revokeRaffleTicket(reg.id);
    if (!revoke.ok) return { ok: false, message: revoke.message };
    ticketRevoked = revoke.revoked;
  }

  await prisma.holidayEventRegistration.update({
    where: { id: reg.id },
    data: {
      present: params.present,
      attendanceMarkedAt: new Date(),
      attendanceMarkedByTeacherId:
        params.markedBy.kind === "teacher" ? params.markedBy.teacherId : null,
      attendanceMarkedByUserId: params.markedBy.kind === "staff" ? params.markedBy.userId : null,
      ...(params.present
        ? {}
        : { certificateUrl: null, certificatePublicId: null, certificateFileName: null }),
    },
  });

  const participantName = (reg.user?.name ?? reg.guestName ?? "Participante").trim();
  const eventName = reg.holiday.name?.trim() || `Evento ${BRAND.shortName}`;

  if (!params.present) {
    return {
      ok: true,
      registrationId: reg.id,
      present: false,
      participantName,
      raffleNumber: null,
      certificateUrl: null,
      ticketRevoked,
    };
  }

  const raffleCount = await prisma.holidayEventRaffle.count({
    where: {
      holidayId: reg.holidayId,
      occurrenceDate: reg.occurrenceDate,
      status: { not: "CANCELLED" },
    },
  });

  const raffleNumber =
    raffleCount > 0
      ? await issueRaffleTicket({
          registrationId: reg.id,
          holidayId: reg.holidayId,
          occurrenceDate: reg.occurrenceDate,
        })
      : (reg.raffleTicket?.number ?? null);

  const responsibleTeacherName =
    params.markedBy.kind === "teacher"
      ? params.markedBy.teacherName
      : await prisma.teacher
          .findFirst({
            where: { id: reg.holiday.responsibleTeacherId ?? "", deletedAt: null },
            select: { name: true },
          })
          .then((t) => t?.name ?? null);

  const certificateUrl =
    reg.certificateUrl ??
    (await ensureEventCertificate({
      registrationId: reg.id,
      participantName,
      eventName,
      occurrenceDate: reg.occurrenceDate,
      eventStartTime: reg.holiday.eventStartTime,
      eventEndTime: reg.holiday.eventEndTime,
      responsibleTeacherName,
    }));

  if (params.notifyParticipant) {
    const to = reg.user?.email ?? reg.guestEmail ?? null;
    if (to) {
      const { subject, html } = templateHolidayEventAttendanceConfirmed({
        name: participantName,
        eventName: formatHolidayEventLabel(
          reg.holiday.name,
          reg.holiday.eventStartTime,
          reg.holiday.eventEndTime,
        ),
        occurrenceDateLabel: formatHolidayEventOccurrenceDisplay(
          reg.occurrenceDate,
          reg.holiday.recurring,
        ),
        raffleNumber,
        raffleCount,
        eventUrl: getAppUrl(holidayEventPublicPath(reg.holiday, reg.occurrenceDate)),
      });
      await sendEmailAndRecord({
        to,
        subject,
        html,
        emailType: "HOLIDAY_EVENT_ATTENDANCE_CONFIRMED",
        entityType: "HolidayEventRegistration",
        entityId: reg.id,
      });
    }
  }

  return {
    ok: true,
    registrationId: reg.id,
    present: true,
    participantName,
    raffleNumber,
    certificateUrl,
    ticketRevoked: false,
  };
}
