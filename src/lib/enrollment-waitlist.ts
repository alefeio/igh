import "server-only";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { sendEnrollmentWelcomeForStudent } from "@/lib/enrollment-welcome-email";
import { notifyTeachersOfWaitlistEnrollment } from "@/lib/waitlist-teacher-notifications";
import { ENROLLMENT_STATUSES_OCCUPYING_SEAT } from "@/lib/enrollment-seat";

export type WaitlistStatus = "WAITING" | "CONVERTED" | "CANCELLED";
export { sendEnrollmentWelcomeForStudent } from "@/lib/enrollment-welcome-email";

export type EnrollFromWaitlistResult =
  | { ok: true; enrollmentId: string; studentId: string }
  | { ok: false; code: "NOT_FOUND" | "FULL" | "CLOSED" | "ALREADY_ENROLLED"; message: string };

/**
 * Inclui um aluno específico da lista de espera na turma, se ainda houver vaga.
 * Não percorre a fila sozinho: quem chama escolhe a reserva.
 */
export async function enrollStudentFromWaitlist(params: {
  classGroupId: string;
  waitlistId: string;
  performedByUserId?: string | null;
}): Promise<EnrollFromWaitlistResult> {
  const classGroup = await prisma.classGroup.findUnique({
    where: { id: params.classGroupId },
    select: { id: true, capacity: true, status: true },
  });
  if (!classGroup) {
    return { ok: false, code: "NOT_FOUND", message: "Turma não encontrada." };
  }
  if (["ENCERRADA", "CANCELADA"].includes(classGroup.status)) {
    return { ok: false, code: "CLOSED", message: "Esta turma não aceita novas matrículas." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.enrollmentWaitlist.findFirst({
      where: { id: params.waitlistId, classGroupId: params.classGroupId, status: "WAITING" },
      select: { id: true, studentId: true },
    });
    if (!entry) return { error: "NOT_FOUND" as const };

    const occupiedCount = await tx.enrollment.count({
      where: {
        classGroupId: params.classGroupId,
        status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] },
      },
    });
    if (occupiedCount >= classGroup.capacity) return { error: "FULL" as const };

    const alreadyActive = await tx.enrollment.findFirst({
      where: {
        studentId: entry.studentId,
        classGroupId: params.classGroupId,
        status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] },
      },
      select: { id: true },
    });
    if (alreadyActive) {
      await tx.enrollmentWaitlist.update({
        where: { id: entry.id },
        data: { status: "CANCELLED" },
      });
      return { error: "ALREADY_ENROLLED" as const };
    }

    const enrollment = await tx.enrollment.create({
      data: {
        studentId: entry.studentId,
        classGroupId: params.classGroupId,
        status: "ACTIVE",
        isPreEnrollment: false,
      },
    });

    await tx.enrollmentWaitlist.update({
      where: { id: entry.id },
      data: {
        status: "CONVERTED",
        convertedEnrollmentId: enrollment.id,
      },
    });

    return { enrollmentId: enrollment.id, studentId: entry.studentId, waitlistId: entry.id };
  });

  if ("error" in result) {
    if (result.error === "FULL") {
      return { ok: false, code: "FULL", message: "Não há vaga nesta turma." };
    }
    if (result.error === "ALREADY_ENROLLED") {
      return { ok: false, code: "ALREADY_ENROLLED", message: "Este aluno já está na turma." };
    }
    return { ok: false, code: "NOT_FOUND", message: "Reserva não encontrada nesta turma." };
  }

  try {
    await createAuditLog({
      entityType: "Enrollment",
      entityId: result.enrollmentId,
      action: "CREATE",
      diff: {
        fromWaitlist: true,
        waitlistId: result.waitlistId,
        studentId: result.studentId,
        classGroupId: params.classGroupId,
        manual: true,
      },
      performedByUserId: params.performedByUserId ?? undefined,
    });
  } catch (e) {
    console.error("[waitlist] audit após inclusão manual", result.enrollmentId, e);
  }

  try {
    await sendEnrollmentWelcomeForStudent({
      studentId: result.studentId,
      enrollmentId: result.enrollmentId,
      performedByUserId: params.performedByUserId,
      emailType: "welcome_student_waitlist",
      auditExtra: { fromWaitlist: true, manual: true },
    });
  } catch (e) {
    console.error("[waitlist] e-mail de boas-vindas após inclusão manual", result.enrollmentId, e);
  }

  try {
    await notifyTeachersOfWaitlistEnrollment(result.enrollmentId);
  } catch (e) {
    console.error("[waitlist] falha ao notificar professor", result.enrollmentId, e);
  }

  return { ok: true, enrollmentId: result.enrollmentId, studentId: result.studentId };
}
