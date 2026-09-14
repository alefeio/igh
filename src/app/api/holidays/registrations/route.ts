import type { Prisma } from "@/generated/prisma/client";

import { requireStaffRead, requireStaffWrite } from "@/lib/auth";
import {
  registerGuestForHolidayEvent,
  registerUserForHolidayEvent,
  validateHolidayOccurrenceDate,
} from "@/lib/holiday-event-registration";
import {
  holidayRegistrationUserInclude,
  resolveHolidayRegistrationStudentLinks,
} from "@/lib/holiday-event-registration-stats";
import { resolveHolidayEventReferrer } from "@/lib/holiday-event-referral";
import { setHolidayEventAttendance } from "@/lib/holiday-event-attendance";
import { jsonErr, jsonOk } from "@/lib/http";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import { prisma } from "@/lib/prisma";
import { adminHolidayEventRegisterSchema } from "@/lib/validators/holiday-event-registration";

function brazilTodayYmd(): string {
  const d = getBrazilTodayDateOnly();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: Request) {
  try {
    await requireStaffRead();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "all";
  const holidayId = searchParams.get("holidayId")?.trim() || null;
  const occurrenceDate = searchParams.get("occurrenceDate")?.trim() || null;
  const q = searchParams.get("q")?.trim() || null;

  const today = brazilTodayYmd();

  const where: Prisma.HolidayEventRegistrationWhereInput = {
    holiday: {
      allowsRegistration: true,
      eventStartTime: { not: null },
      eventEndTime: { not: null },
    },
  };

  if (holidayId) where.holidayId = holidayId;
  if (occurrenceDate) {
    where.occurrenceDate = occurrenceDate;
  } else if (scope === "upcoming") {
    where.occurrenceDate = { gte: today };
  } else if (scope === "past") {
    where.occurrenceDate = { lt: today };
  }

  if (q) {
    const qDigits = q.replace(/\D/g, "");
    const or: Prisma.HolidayEventRegistrationWhereInput[] = [
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { guestName: { contains: q, mode: "insensitive" } },
      { guestEmail: { contains: q, mode: "insensitive" } },
      { guestCpf: { contains: q } },
      { checkinCode: { contains: q, mode: "insensitive" } },
      { holiday: { name: { contains: q, mode: "insensitive" } } },
      { holiday: { subtitle: { contains: q, mode: "insensitive" } } },
    ];
    // Telefone: busca também só pelos dígitos (cadastro guarda sem máscara).
    if (qDigits.length >= 3) {
      or.push(
        { user: { whatsapp: { contains: qDigits } } },
        { guestPhone: { contains: qDigits } },
      );
    } else {
      or.push(
        { user: { whatsapp: { contains: q } } },
        { guestPhone: { contains: q } },
      );
    }
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: or },
    ];
  }

  const registrations = await prisma.holidayEventRegistration.findMany({
    where,
    orderBy: [{ occurrenceDate: "desc" }, { createdAt: "asc" }],
    include: {
      user: { select: holidayRegistrationUserInclude },
      referrerUser: { select: { id: true, name: true } },
      raffleTicket: { select: { number: true } },
      holiday: {
        select: {
          id: true,
          name: true,
          subtitle: true,
          slug: true,
          recurring: true,
          eventStartTime: true,
          eventEndTime: true,
          allowsRegistration: true,
          allowsReferral: true,
          isActive: true,
          capacity: true,
        },
      },
    },
  });

  const studentLinks = await resolveHolidayRegistrationStudentLinks(registrations);
  const registrationsWithStats = registrations.map((row) => ({
    ...row,
    studentLink: studentLinks.get(row.id) ?? null,
  }));

  // Com holidayId focado e ainda sem inscritos, devolve o evento para o painel criar o grupo vazio.
  let emptyEvent:
    | {
        id: string;
        name: string | null;
        subtitle: string | null;
        slug: string | null;
        recurring: boolean;
        eventStartTime: string | null;
        eventEndTime: string | null;
        allowsRegistration: boolean;
        allowsReferral: boolean;
        isActive: boolean;
        capacity: number | null;
        occurrenceDate: string;
      }
    | null = null;

  if (holidayId && registrationsWithStats.length === 0) {
    const holiday = await prisma.holiday.findFirst({
      where: {
        id: holidayId,
        allowsRegistration: true,
        eventStartTime: { not: null },
        eventEndTime: { not: null },
      },
      select: {
        id: true,
        name: true,
        subtitle: true,
        slug: true,
        recurring: true,
        eventStartTime: true,
        eventEndTime: true,
        allowsRegistration: true,
        allowsReferral: true,
        isActive: true,
        capacity: true,
        date: true,
      },
    });
    if (holiday) {
      const y = holiday.date.getUTCFullYear();
      const m = String(holiday.date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(holiday.date.getUTCDate()).padStart(2, "0");
      const date =
        occurrenceDate && /^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)
          ? occurrenceDate
          : `${y}-${m}-${d}`;
      emptyEvent = {
        id: holiday.id,
        name: holiday.name,
        subtitle: holiday.subtitle,
        slug: holiday.slug,
        recurring: holiday.recurring,
        eventStartTime: holiday.eventStartTime,
        eventEndTime: holiday.eventEndTime,
        allowsRegistration: holiday.allowsRegistration,
        allowsReferral: holiday.allowsReferral,
        isActive: holiday.isActive,
        capacity: holiday.capacity,
        occurrenceDate: date,
      };
    }
  }

  if (scope !== "past") {
    registrationsWithStats.sort((a, b) => {
      const dateCmp = a.occurrenceDate.localeCompare(b.occurrenceDate);
      if (dateCmp !== 0) return dateCmp;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  return jsonOk({ registrations: registrationsWithStats, today, emptyEvent });
}

export async function POST(request: Request) {
  let staff: Awaited<ReturnType<typeof requireStaffWrite>>;
  try {
    staff = await requireStaffWrite();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = adminHolidayEventRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  const {
    holidayId,
    occurrenceDate,
    userEmail,
    name,
    phone,
    email,
    cpf,
    referrerUserId,
    referrerQuery,
    markPresent,
  } = parsed.data;

  const holidayOk = await prisma.holiday.findFirst({
    where: {
      id: holidayId,
      isActive: true,
      allowsRegistration: true,
      eventStartTime: { not: null },
      eventEndTime: { not: null },
    },
  });
  if (!holidayOk) return jsonErr("NOT_FOUND", "Evento não encontrado ou sem inscrições.", 404);

  const check = await validateHolidayOccurrenceDate(holidayId, occurrenceDate);
  const canUsePublicFlow = check.ok;
  const referralFields = {
    referrerUserId: referrerUserId ?? null,
    referrerQuery: referrerQuery ?? null,
    skipReferralRequirement: true as const,
  };

  async function finish(params: {
    registration: { id: string; present?: boolean | null };
    alreadyRegistered: boolean;
    participantName: string;
  }) {
    let raffleNumber: number | null = null;
    let markedPresent = params.registration.present === true;

    if (markPresent && !markedPresent) {
      const att = await setHolidayEventAttendance({
        registrationId: params.registration.id,
        present: true,
        markedBy: { kind: "staff", userId: staff.id, userName: staff.name },
        notifyParticipant: true,
      });
      if (!att.ok) {
        return jsonOk(
          {
            registration: params.registration,
            alreadyRegistered: params.alreadyRegistered,
            participantName: params.participantName,
            markedPresent: false,
            raffleNumber: null,
            markPresentError: att.message,
          },
          { status: params.alreadyRegistered ? 200 : 201 },
        );
      }
      markedPresent = true;
      raffleNumber = att.raffleNumber;
    } else if (markedPresent) {
      const ticket = await prisma.holidayEventRaffleTicket.findUnique({
        where: { registrationId: params.registration.id },
        select: { number: true },
      });
      raffleNumber = ticket?.number ?? null;
    }

    return jsonOk(
      {
        registration: params.registration,
        alreadyRegistered: params.alreadyRegistered,
        participantName: params.participantName,
        markedPresent,
        raffleNumber,
      },
      { status: params.alreadyRegistered ? 200 : 201 },
    );
  }

  if (userEmail) {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, name: true, email: true, whatsapp: true, isActive: true },
    });
    if (!user) {
      return jsonErr("NOT_FOUND", "Nenhum usuário encontrado com este e-mail.", 404);
    }
    if (!user.isActive) {
      return jsonErr("VALIDATION_ERROR", "Este usuário está inativo.", 400);
    }

    if (canUsePublicFlow) {
      const result = await registerUserForHolidayEvent({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        holidayId,
        occurrenceDate,
        ...referralFields,
      });
      if (!result.ok) return jsonErr("VALIDATION_ERROR", result.message, 400);
      return finish({
        registration: result.registration,
        alreadyRegistered: result.alreadyRegistered,
        participantName: user.name,
      });
    }

    const existing = await prisma.holidayEventRegistration.findFirst({
      where: {
        holidayId,
        occurrenceDate,
        OR: [
          { userId: user.id },
          ...(user.whatsapp ? [{ guestPhone: user.whatsapp.replace(/\D/g, "") }] : []),
        ],
      },
    });
    if (existing) {
      return finish({
        registration: existing,
        alreadyRegistered: true,
        participantName: user.name,
      });
    }

    const referral = await resolveHolidayEventReferrer({
      holiday: holidayOk,
      referrerUserId,
      selfUserId: user.id,
      selfEmail: user.email,
      skipRequirement: true,
    });
    if (!referral.ok) return jsonErr("VALIDATION_ERROR", referral.message, 400);

    const registration = await prisma.holidayEventRegistration.create({
      data: {
        holidayId,
        userId: user.id,
        occurrenceDate,
        referrerUserId: referral.referrerUserId,
        referrerQuery: referral.referrerUserId ? referrerQuery : null,
      },
    });
    return finish({
      registration,
      alreadyRegistered: false,
      participantName: user.name,
    });
  }

  if (!name || !phone) {
    return jsonErr("VALIDATION_ERROR", "Informe nome e telefone.", 400);
  }

  if (canUsePublicFlow) {
    const result = await registerGuestForHolidayEvent({
      holidayId,
      occurrenceDate,
      name,
      phone,
      email,
      cpf,
      ...referralFields,
    });
    if (!result.ok) return jsonErr("VALIDATION_ERROR", result.message, 400);
    return finish({
      registration: result.registration,
      alreadyRegistered: result.alreadyRegistered,
      participantName: name.trim(),
    });
  }

  const phoneDigits = phone.replace(/\D/g, "");
  const existingGuest = await prisma.holidayEventRegistration.findFirst({
    where: {
      holidayId,
      occurrenceDate,
      OR: [{ guestPhone: phoneDigits }, { user: { whatsapp: phoneDigits } }],
    },
    include: { user: { select: { name: true } } },
  });
  if (existingGuest) {
    return finish({
      registration: existingGuest,
      alreadyRegistered: true,
      participantName: existingGuest.user?.name ?? existingGuest.guestName ?? name.trim(),
    });
  }

  const referral = await resolveHolidayEventReferrer({
    holiday: holidayOk,
    referrerUserId,
    selfPhone: phoneDigits,
    selfEmail: email,
    skipRequirement: true,
  });
  if (!referral.ok) return jsonErr("VALIDATION_ERROR", referral.message, 400);

  const registration = await prisma.holidayEventRegistration.create({
    data: {
      holidayId,
      occurrenceDate,
      guestName: name.trim(),
      guestPhone: phoneDigits,
      guestEmail: email || null,
      guestCpf: cpf || null,
      referrerUserId: referral.referrerUserId,
      referrerQuery: referral.referrerUserId ? referrerQuery : null,
    },
  });
  return finish({
    registration,
    alreadyRegistered: false,
    participantName: name.trim(),
  });
}

