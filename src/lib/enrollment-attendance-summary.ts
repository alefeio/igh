import "server-only";

import { getEndOfTodayBrazil } from "@/lib/brazil-today";
import { prisma } from "@/lib/prisma";

export type EnrollmentAttendanceSummary = {
  presentCount: number;
  totalSessions: number;
  percent: number | null;
};

/**
 * Presenças do aluno / total de aulas elegíveis da turma.
 * Considera sessões até hoje (calendário Brasil), exceto canceladas — alinhado ao painel de frequência
 * e ao fluxo do aluno/professor (não exige status LIBERADA persistido antes da consulta).
 */
export async function getEnrollmentAttendanceSummaries(
  enrollmentIds: string[]
): Promise<Map<string, EnrollmentAttendanceSummary>> {
  const result = new Map<string, EnrollmentAttendanceSummary>();
  if (enrollmentIds.length === 0) return result;

  const uniqueIds = [...new Set(enrollmentIds)];
  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, classGroupId: true },
  });

  const classGroupIds = [...new Set(enrollments.map((e) => e.classGroupId))];
  const endOfTodayBrazil = getEndOfTodayBrazil();

  const sessions = await prisma.classSession.findMany({
    where: {
      classGroupId: { in: classGroupIds },
      status: { not: "CANCELED" },
      sessionDate: { lte: endOfTodayBrazil },
    },
    select: { id: true, classGroupId: true },
  });

  const totalByClassGroup = new Map<string, number>();
  for (const cgId of classGroupIds) {
    totalByClassGroup.set(
      cgId,
      sessions.filter((s) => s.classGroupId === cgId).length
    );
  }

  const allSessionIds = sessions.map((s) => s.id);
  const presentByEnrollment = new Map<string, number>();
  if (allSessionIds.length > 0) {
    const grouped = await prisma.sessionAttendance.groupBy({
      by: ["enrollmentId"],
      where: {
        enrollmentId: { in: uniqueIds },
        classSessionId: { in: allSessionIds },
        present: true,
      },
      _count: { id: true },
    });
    for (const row of grouped) {
      presentByEnrollment.set(row.enrollmentId, row._count.id);
    }
  }

  for (const e of enrollments) {
    const totalSessions = totalByClassGroup.get(e.classGroupId) ?? 0;
    const presentCount = presentByEnrollment.get(e.id) ?? 0;
    result.set(e.id, {
      presentCount,
      totalSessions,
      percent: totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null,
    });
  }

  return result;
}

export function formatEnrollmentAttendanceSummary(summary: EnrollmentAttendanceSummary | undefined): string {
  if (!summary) return "—";
  if (summary.totalSessions === 0) return `${summary.presentCount}/0`;
  return `${summary.presentCount}/${summary.totalSessions} (${summary.percent}%)`;
}
