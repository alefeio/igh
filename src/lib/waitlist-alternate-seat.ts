import "server-only";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import {
  checkWaitlistAlternateOfferEligibility,
} from "@/lib/email/transactional-eligibility-db";
import { templateWaitlistAlternateSeatOffer } from "@/lib/email/templates";
import { formatDateOnly } from "@/lib/format";
import { generateSecureToken, hashToken } from "@/lib/verification-token";
import { getAppUrl } from "@/lib/email";
import { PUBLIC_INSCREVA_STATUSES } from "@/lib/public-enrollment-availability";
import { ENROLLMENT_STATUSES_OCCUPYING_SEAT } from "@/lib/enrollment-seat";

const OFFER_EXPIRY_DAYS = 5;

/**
 * Quando uma vaga abre e a turma não tem fila própria, oferece a vaga por e-mail
 * a alunos WAITING em outras turmas do mesmo curso e ciclo.
 */
export async function notifyWaitlistStudentsOfAlternateSeat(
  classGroupId: string,
  performedByUserId?: string | null,
): Promise<{ offered: number }> {
  const classGroup = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: {
      id: true,
      capacity: true,
      status: true,
      isExternal: true,
      courseId: true,
      cycleId: true,
      startDate: true,
      startTime: true,
      endTime: true,
      daysOfWeek: true,
      location: true,
      course: { select: { name: true } },
      cycle: { select: { cycle: true, year: true } },
    },
  });
  if (!classGroup) return { offered: 0 };
  if (classGroup.isExternal) return { offered: 0 };
  if (!PUBLIC_INSCREVA_STATUSES.includes(classGroup.status as (typeof PUBLIC_INSCREVA_STATUSES)[number])) {
    return { offered: 0 };
  }
  if (["ENCERRADA", "CANCELADA"].includes(classGroup.status)) return { offered: 0 };

  const occupiedCount = await prisma.enrollment.count({
    where: { classGroupId, status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } },
  });
  if (occupiedCount >= classGroup.capacity) return { offered: 0 };

  const ownWaiting = await prisma.enrollmentWaitlist.count({
    where: { classGroupId, status: "WAITING" },
  });
  if (ownWaiting > 0) return { offered: 0 };

  const candidates = await prisma.enrollmentWaitlist.findMany({
    where: {
      status: "WAITING",
      classGroupId: { not: classGroupId },
      classGroup: {
        courseId: classGroup.courseId,
        cycleId: classGroup.cycleId,
      },
      student: {
        deletedAt: null,
        email: { not: null },
        NOT: {
          enrollments: {
            some: {
              isPreEnrollment: false,
              status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] },
              classGroup: { courseId: classGroup.courseId },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      studentId: true,
      student: { select: { id: true, name: true, email: true, userId: true } },
      classGroup: {
        select: {
          startTime: true,
          endTime: true,
          daysOfWeek: true,
          location: true,
        },
      },
    },
  });

  if (candidates.length === 0) return { offered: 0 };

  const alreadyOffered = await prisma.waitlistSeatOffer.findMany({
    where: {
      classGroupId,
      studentId: { in: candidates.map((c) => c.studentId) },
      status: { in: ["PENDING", "ACCEPTED"] },
    },
    select: { studentId: true },
  });
  const offeredSet = new Set(alreadyOffered.map((o) => o.studentId));

  const daysFormatted = Array.isArray(classGroup.daysOfWeek)
    ? classGroup.daysOfWeek.join(", ")
    : String(classGroup.daysOfWeek);
  const cycleLabel = `Ciclo ${classGroup.cycle.cycle}/${classGroup.cycle.year}`;
  const startDate = formatDateOnly(classGroup.startDate);

  let offered = 0;
  for (const entry of candidates) {
    if (offeredSet.has(entry.studentId)) continue;
    const email = entry.student.email?.trim();
    if (!email) continue;

    const stillWaiting = await prisma.enrollmentWaitlist.findFirst({
      where: { id: entry.id, status: "WAITING", studentId: entry.studentId },
      select: { id: true },
    });
    if (!stillWaiting) continue;

    const eligibility = await checkWaitlistAlternateOfferEligibility({
      classGroupId,
      studentId: entry.studentId,
      recipientEmail: email,
      sourceWaitlistId: entry.id,
    });
    if (!eligibility.eligible) continue;

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + OFFER_EXPIRY_DAYS);

    try {
      await prisma.waitlistSeatOffer.create({
        data: {
          studentId: entry.studentId,
          classGroupId,
          sourceWaitlistId: entry.id,
          tokenHash,
          expiresAt,
        },
      });
    } catch {
      // unique studentId+classGroupId — já oferecido
      continue;
    }

    const originalTurma = [
      entry.classGroup.daysOfWeek?.join(", "),
      entry.classGroup.startTime && entry.classGroup.endTime
        ? `${entry.classGroup.startTime}–${entry.classGroup.endTime}`
        : null,
      entry.classGroup.location,
    ]
      .filter(Boolean)
      .join(" · ");

    const acceptUrl = getAppUrl(`/aceitar-vaga?token=${rawToken}`);
    const { subject, html } = templateWaitlistAlternateSeatOffer({
      name: entry.student.name,
      courseName: classGroup.course.name,
      cycleLabel,
      startDate,
      daysOfWeek: daysFormatted,
      startTime: classGroup.startTime,
      endTime: classGroup.endTime,
      location: classGroup.location,
      originalTurmaLabel: originalTurma || "outra turma do mesmo curso",
      acceptUrl,
    });

    await sendEmailAndRecord({
      to: email,
      subject,
      html,
      emailType: "waitlist_alternate_seat_offer",
      entityType: "WaitlistSeatOffer",
      entityId: `${classGroupId}:${entry.studentId}`,
      performedByUserId,
    });

    offered += 1;
  }

  return { offered };
}

/** Aceita oferta de vaga: matricula o aluno se ainda houver vaga. */
export async function acceptWaitlistSeatOffer(rawToken: string): Promise<
  | { ok: true; enrollmentId: string; studentId: string; courseName: string }
  | { ok: false; code: string; message: string }
> {
  const tokenHash = hashToken(rawToken);
  const offer = await prisma.waitlistSeatOffer.findFirst({
    where: { tokenHash },
    include: {
      classGroup: {
        select: {
          id: true,
          capacity: true,
          status: true,
          courseId: true,
          cycleId: true,
          course: { select: { name: true } },
        },
      },
      student: { select: { id: true, name: true, email: true } },
    },
  });

  if (!offer) return { ok: false, code: "NOT_FOUND", message: "Link inválido ou expirado." };
  if (offer.status === "ACCEPTED") {
    return { ok: false, code: "ALREADY_ACCEPTED", message: "Você já aceitou esta vaga." };
  }
  if (offer.status !== "PENDING" || offer.expiresAt < new Date()) {
    if (offer.status === "PENDING") {
      await prisma.waitlistSeatOffer.update({
        where: { id: offer.id },
        data: { status: "EXPIRED" },
      });
    }
    return { ok: false, code: "EXPIRED", message: "Esta oferta de vaga expirou." };
  }

  if (["ENCERRADA", "CANCELADA"].includes(offer.classGroup.status)) {
    return { ok: false, code: "CLASS_CLOSED", message: "Esta turma não está mais disponível." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const occupiedCount = await tx.enrollment.count({
      where: { classGroupId: offer.classGroupId, status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } },
    });
    if (occupiedCount >= offer.classGroup.capacity) {
      return { error: "FULL" as const };
    }

    const already = await tx.enrollment.findFirst({
      where: {
        studentId: offer.studentId,
        status: "ACTIVE",
        classGroup: { courseId: offer.classGroup.courseId },
      },
      select: { id: true },
    });
    if (already) return { error: "ALREADY_ENROLLED" as const };

    const enrollment = await tx.enrollment.create({
      data: {
        studentId: offer.studentId,
        classGroupId: offer.classGroupId,
        status: "ACTIVE",
        isPreEnrollment: false,
      },
    });

    await tx.waitlistSeatOffer.update({
      where: { id: offer.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    // Cancela reservas WAITING do mesmo curso/ciclo (incluindo a origem).
    await tx.enrollmentWaitlist.updateMany({
      where: {
        studentId: offer.studentId,
        status: "WAITING",
        classGroup: {
          courseId: offer.classGroup.courseId,
          cycleId: offer.classGroup.cycleId,
        },
      },
      data: { status: "CANCELLED" },
    });

    return { enrollmentId: enrollment.id };
  });

  if ("error" in result) {
    if (result.error === "FULL") {
      return {
        ok: false,
        code: "FULL",
        message: "A vaga já foi preenchida. Entre na lista de espera se ainda houver interesse.",
      };
    }
    return {
      ok: false,
      code: "ALREADY_ENROLLED",
      message: "Você já possui matrícula ativa neste curso.",
    };
  }

  await createAuditLog({
    entityType: "Enrollment",
    entityId: result.enrollmentId,
    action: "CREATE",
    diff: {
      fromWaitlistSeatOffer: true,
      offerId: offer.id,
      studentId: offer.studentId,
      classGroupId: offer.classGroupId,
    },
  });

  return {
    ok: true,
    enrollmentId: result.enrollmentId,
    studentId: offer.studentId,
    courseName: offer.classGroup.course.name,
  };
}
