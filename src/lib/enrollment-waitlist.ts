import "server-only";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { sendEnrollmentWelcomeForStudent } from "@/lib/enrollment-welcome-email";
import { notifyTeachersOfWaitlistEnrollment } from "@/lib/waitlist-teacher-notifications";

export type WaitlistStatus = "WAITING" | "CONVERTED" | "CANCELLED";
export { sendEnrollmentWelcomeForStudent } from "@/lib/enrollment-welcome-email";

/**
 * Se houver vaga e reserva WAITING, promove o primeiro da fila (FIFO) a matrícula ACTIVE
 * e dispara o e-mail de acesso.
 */
export async function promoteNextWaitlistForClassGroup(
  classGroupId: string,
  performedByUserId?: string | null,
): Promise<{ promoted: boolean; enrollmentId?: string; studentId?: string }> {
  const classGroup = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: { id: true, capacity: true, status: true },
  });
  if (!classGroup) return { promoted: false };
  if (["ENCERRADA", "CANCELADA"].includes(classGroup.status)) {
    return { promoted: false };
  }

  const result = await prisma.$transaction(async (tx) => {
    const activeCount = await tx.enrollment.count({
      where: { classGroupId, status: "ACTIVE" },
    });
    if (activeCount >= classGroup.capacity) {
      return null;
    }

    // Tenta o próximo WAITING válido (pula quem já tenha matrícula ACTIVE).
    for (let attempt = 0; attempt < 20; attempt++) {
      const next = await tx.enrollmentWaitlist.findFirst({
        where: { classGroupId, status: "WAITING" },
        orderBy: { createdAt: "asc" },
        select: { id: true, studentId: true },
      });
      if (!next) return null;

      const alreadyActive = await tx.enrollment.findFirst({
        where: { studentId: next.studentId, classGroupId, status: "ACTIVE" },
        select: { id: true },
      });
      if (alreadyActive) {
        await tx.enrollmentWaitlist.update({
          where: { id: next.id },
          data: { status: "CANCELLED" },
        });
        continue;
      }

      const enrollment = await tx.enrollment.create({
        data: {
          studentId: next.studentId,
          classGroupId,
          status: "ACTIVE",
          isPreEnrollment: false,
        },
      });

      await tx.enrollmentWaitlist.update({
        where: { id: next.id },
        data: {
          status: "CONVERTED",
          convertedEnrollmentId: enrollment.id,
        },
      });

      return { enrollmentId: enrollment.id, studentId: next.studentId, waitlistId: next.id };
    }

    return null;
  });

  if (!result) return { promoted: false };

  await createAuditLog({
    entityType: "Enrollment",
    entityId: result.enrollmentId,
    action: "CREATE",
    diff: {
      fromWaitlist: true,
      waitlistId: result.waitlistId,
      studentId: result.studentId,
      classGroupId,
    },
    performedByUserId: performedByUserId ?? undefined,
  });

  await sendEnrollmentWelcomeForStudent({
    studentId: result.studentId,
    enrollmentId: result.enrollmentId,
    performedByUserId,
    emailType: "welcome_student_waitlist",
    auditExtra: { fromWaitlist: true },
  });

  try {
    await notifyTeachersOfWaitlistEnrollment(result.enrollmentId);
  } catch (e) {
    console.error("[waitlist] falha ao notificar professor", result.enrollmentId, e);
  }

  return {
    promoted: true,
    enrollmentId: result.enrollmentId,
    studentId: result.studentId,
  };
}

/** Após liberar vaga (cancelamento/exclusão), tenta promover a próxima reserva.
 * Se não houver fila nesta turma, oferece a vaga a quem espera em outras turmas
 * do mesmo curso/ciclo. */
export async function tryPromoteWaitlistAfterSeatFreed(
  classGroupId: string,
  performedByUserId?: string | null,
): Promise<void> {
  try {
    const result = await promoteNextWaitlistForClassGroup(classGroupId, performedByUserId);
    if (result.promoted) return;
    const { notifyWaitlistStudentsOfAlternateSeat } = await import(
      "@/lib/waitlist-alternate-seat"
    );
    await notifyWaitlistStudentsOfAlternateSeat(classGroupId, performedByUserId);
  } catch (e) {
    console.error("[waitlist] falha ao promover reserva / ofertar vaga", classGroupId, e);
  }
}
