import "server-only";

import { getEndOfTodayBrazil } from "@/lib/brazil-today";
import { splitAbsenceCounts } from "@/lib/enrollment-frequency-label";
import { sessionCountsForEnrollment } from "@/lib/enrollment-session-window";
import { prisma } from "@/lib/prisma";

export type EnrollmentAttendanceSummary = {
  presentCount: number;
  recordedCount: number;
  totalSessions: number;
  percent: number | null;
  justifiedAbsenceCount: number;
  unjustifiedAbsenceCount: number;
};

/**
 * Presenças do aluno / aulas da turma a partir do dia da matrícula.
 * Sessões anteriores à matrícula não entram no total nem como falta.
 * Considera sessões até hoje (calendário Brasil), exceto canceladas.
 */
export async function getEnrollmentAttendanceSummaries(
  enrollmentIds: string[]
): Promise<Map<string, EnrollmentAttendanceSummary>> {
  const result = new Map<string, EnrollmentAttendanceSummary>();
  if (enrollmentIds.length === 0) return result;

  const uniqueIds = [...new Set(enrollmentIds)];
  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, classGroupId: true, enrolledAt: true },
  });

  const classGroupIds = [...new Set(enrollments.map((e) => e.classGroupId))];
  const endOfTodayBrazil = getEndOfTodayBrazil();

  const sessions = await prisma.classSession.findMany({
    where: {
      classGroupId: { in: classGroupIds },
      status: { not: "CANCELED" },
      sessionDate: { lte: endOfTodayBrazil },
    },
    select: { id: true, classGroupId: true, sessionDate: true },
  });

  const sessionsByGroup = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const list = sessionsByGroup.get(session.classGroupId) ?? [];
    list.push(session);
    sessionsByGroup.set(session.classGroupId, list);
  }

  const allowedByEnrollment = new Map<string, Set<string>>();
  for (const enrollment of enrollments) {
    const allowed = new Set<string>();
    for (const session of sessionsByGroup.get(enrollment.classGroupId) ?? []) {
      if (sessionCountsForEnrollment(session.sessionDate, enrollment.enrolledAt)) allowed.add(session.id);
    }
    allowedByEnrollment.set(enrollment.id, allowed);
  }

  const allSessionIds = sessions.map((s) => s.id);
  const marksByEnrollment = new Map<
    string,
    { enrollmentId: string; classSessionId: string; present: boolean; absenceJustification: string | null }[]
  >();
  if (allSessionIds.length > 0) {
    const marks = await prisma.sessionAttendance.findMany({
      where: {
        enrollmentId: { in: uniqueIds },
        classSessionId: { in: allSessionIds },
      },
      select: { enrollmentId: true, classSessionId: true, present: true, absenceJustification: true },
    });
    for (const mark of marks) {
      const list = marksByEnrollment.get(mark.enrollmentId) ?? [];
      list.push(mark);
      marksByEnrollment.set(mark.enrollmentId, list);
    }
  }

  for (const e of enrollments) {
    const allowed = allowedByEnrollment.get(e.id) ?? new Set<string>();
    const marks = (marksByEnrollment.get(e.id) ?? []).filter((mark) => allowed.has(mark.classSessionId));
    const presentCount = marks.filter((mark) => mark.present).length;
    const absences = splitAbsenceCounts(marks.filter((mark) => !mark.present)).get(e.id);
    const totalSessions = allowed.size;
    result.set(e.id, {
      presentCount,
      recordedCount: marks.length,
      totalSessions,
      percent: totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null,
      justifiedAbsenceCount: absences?.justifiedAbsenceCount ?? 0,
      unjustifiedAbsenceCount: absences?.unjustifiedAbsenceCount ?? 0,
    });
  }

  return result;
}

export function formatEnrollmentAttendanceSummary(summary: EnrollmentAttendanceSummary | undefined): string {
  if (!summary) return "—";
  if (summary.totalSessions === 0) return `${summary.presentCount}/0`;
  return `${summary.presentCount}/${summary.totalSessions} (${summary.percent}%)`;
}
