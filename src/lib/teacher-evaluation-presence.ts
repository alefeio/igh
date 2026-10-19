import "server-only";

import { getEndOfTodayBrazil } from "@/lib/brazil-today";
import { prisma } from "@/lib/prisma";

/** Matrículas com ao menos uma presença em aula não cancelada, até o fim de hoje no Brasil. */
export async function enrollmentIdsWithRecordedPresence(enrollmentIds: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(enrollmentIds)];
  if (uniqueIds.length === 0) return new Set();

  const rows = await prisma.sessionAttendance.findMany({
    where: {
      enrollmentId: { in: uniqueIds },
      present: true,
      classSession: {
        status: { not: "CANCELED" },
        sessionDate: { lte: getEndOfTodayBrazil() },
      },
    },
    select: { enrollmentId: true },
    distinct: ["enrollmentId"],
  });

  return new Set(rows.map((row) => row.enrollmentId));
}
