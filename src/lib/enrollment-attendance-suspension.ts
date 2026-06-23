import "server-only";

import { createAuditLog } from "@/lib/audit";
import { sendEnrollmentSuspensionEmail } from "@/lib/enrollment-suspension-email";
import { prisma } from "@/lib/prisma";

export const CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT = 3;

export function isUnjustifiedAbsence(row: {
  present: boolean;
  absenceJustification: string | null;
}): boolean {
  if (row.present) return false;
  return (row.absenceJustification ?? "").trim().length === 0;
}

/** Faltas consecutivas sem justificativa, da aula mais recente para trás (só sessões com frequência lançada). */
export async function getConsecutiveUnjustifiedAbsenceStreak(
  enrollmentId: string,
  classGroupId: string
): Promise<number> {
  const sessions = await prisma.classSession.findMany({
    where: { classGroupId, status: { not: "CANCELED" } },
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

  let streak = 0;
  for (const session of sessions) {
    const row = bySession.get(session.id);
    if (!row) break;
    if (isUnjustifiedAbsence(row)) streak += 1;
    else break;
  }
  return streak;
}

type AttendancePatchRow = {
  enrollmentId: string;
  present: boolean;
  absenceJustification: string | null;
};

/**
 * Após salvar frequência: reativa matrícula suspensa com presença; suspende após 3 faltas consecutivas sem justificativa.
 */
export async function applyAttendanceSuspensionRules(params: {
  classGroupId: string;
  rows: AttendancePatchRow[];
  performedByUserId?: string | null;
}): Promise<{ reactivatedIds: string[]; suspendedIds: string[] }> {
  const reactivatedIds: string[] = [];
  const suspendedIds: string[] = [];

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

    if (enrollment.status !== "ACTIVE") continue;

    const streak = await getConsecutiveUnjustifiedAbsenceStreak(enrollment.id, params.classGroupId);
    if (streak >= CONSECUTIVE_UNJUSTIFIED_ABSENCE_LIMIT) {
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
      });
    }
  }

  return { reactivatedIds, suspendedIds };
}
