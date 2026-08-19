import "server-only";

import { createAuditLog } from "@/lib/audit";
import {
  CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT,
  CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT,
  countConsecutiveUnjustifiedAbsenceStreak,
  isUnjustifiedAbsence,
} from "@/lib/enrollment-attendance-streak";
import { sendEnrollmentCancellationEmail, sendEnrollmentSuspensionEmail } from "@/lib/enrollment-suspension-email";
import { tryPromoteWaitlistAfterSeatFreed } from "@/lib/enrollment-waitlist";
import { prisma } from "@/lib/prisma";

export {
  CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT,
  CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT,
  countConsecutiveUnjustifiedAbsenceStreak,
  isUnjustifiedAbsence,
};

/** Faltas consecutivas sem justificativa, da aula mais recente para trás (sessões liberadas). */
export async function getConsecutiveUnjustifiedAbsenceStreak(
  enrollmentId: string,
  classGroupId: string
): Promise<number> {
  const sessions = await prisma.classSession.findMany({
    where: { classGroupId, status: "LIBERADA" },
    orderBy: [{ sessionDate: "desc" }, { startTime: "desc" }],
    select: { id: true },
  });
  if (sessions.length === 0) return 0;

  const sessionIds = sessions.map((s) => s.id);
  const attendances = await prisma.sessionAttendance.findMany({
    where: { enrollmentId, classSessionId: { in: sessionIds } },
    select: { classSessionId: true, present: true, absenceJustification: true },
  });
  const bySession = new Map(attendances.map((a) => [a.classSessionId, a]));

  return countConsecutiveUnjustifiedAbsenceStreak(sessions, bySession);
}

type AttendancePatchRow = {
  enrollmentId: string;
  present: boolean;
  absenceJustification: string | null;
  /** Grade: P/F/J ou null (desmarcar). Ausente nas APIs que só enviam presença. */
  appliedMark?: "P" | "F" | "J" | null;
};

/**
 * Após salvar frequência: reativa matrícula suspensa com presença; suspende após 3 faltas
 * consecutivas sem justificativa; cancela após a 4ª falta consecutiva (já suspenso).
 */
export async function applyAttendanceSuspensionRules(params: {
  classGroupId: string;
  rows: AttendancePatchRow[];
  performedByUserId?: string | null;
}): Promise<{ reactivatedIds: string[]; suspendedIds: string[]; cancelledIds: string[] }> {
  const reactivatedIds: string[] = [];
  const suspendedIds: string[] = [];
  const cancelledIds: string[] = [];

  for (const row of params.rows) {
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: row.enrollmentId, classGroupId: params.classGroupId },
      select: { id: true, status: true, student: { select: { name: true } } },
    });
    if (!enrollment) continue;

    if (row.present && enrollment.status === "SUSPENDED") {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "ACTIVE" },
      });
      reactivatedIds.push(enrollment.id);
      await createAuditLog({
        entityType: "Enrollment",
        entityId: enrollment.id,
        action: "AUTO_REACTIVATE_ATTENDANCE",
        performedByUserId: params.performedByUserId ?? null,
        diff: {
          reason: "Presença registrada na aula presencial",
          studentName: enrollment.student.name,
        },
      });
      continue;
    }

    const streak = await getConsecutiveUnjustifiedAbsenceStreak(enrollment.id, params.classGroupId);
    const markingUnjustifiedAbsence =
      row.appliedMark === undefined
        ? isUnjustifiedAbsence(row)
        : row.appliedMark === "F";

    if (
      enrollment.status === "SUSPENDED" &&
      markingUnjustifiedAbsence &&
      streak >= CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT
    ) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "CANCELLED" },
      });
      cancelledIds.push(enrollment.id);
      await createAuditLog({
        entityType: "Enrollment",
        entityId: enrollment.id,
        action: "AUTO_CANCEL_ATTENDANCE",
        performedByUserId: params.performedByUserId ?? null,
        diff: {
          reason: `${CONSECUTIVE_UNJUSTIFIED_ABSENCE_CANCEL_LIMIT} faltas consecutivas sem justificativa`,
          consecutiveUnjustifiedAbsences: streak,
          studentName: enrollment.student.name,
        },
      });
      await tryPromoteWaitlistAfterSeatFreed(params.classGroupId, params.performedByUserId);
      await sendEnrollmentCancellationEmail({
        enrollmentId: enrollment.id,
        performedByUserId: params.performedByUserId,
        cause: "attendance",
      });
      continue;
    }

    if (enrollment.status !== "ACTIVE") continue;

    if (markingUnjustifiedAbsence && streak >= CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "SUSPENDED" },
      });
      suspendedIds.push(enrollment.id);
      await createAuditLog({
        entityType: "Enrollment",
        entityId: enrollment.id,
        action: "AUTO_SUSPEND_ATTENDANCE",
        performedByUserId: params.performedByUserId ?? null,
        diff: {
          reason: `${CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT} faltas consecutivas sem justificativa`,
          consecutiveUnjustifiedAbsences: streak,
          studentName: enrollment.student.name,
        },
      });
      await sendEnrollmentSuspensionEmail({
        enrollmentId: enrollment.id,
        performedByUserId: params.performedByUserId,
        cause: "attendance",
      });
    }
  }

  return { reactivatedIds, suspendedIds, cancelledIds };
}
