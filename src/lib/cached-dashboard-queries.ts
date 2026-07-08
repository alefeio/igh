import "server-only";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { computeStudentGamificationRanking } from "@/lib/student-gamification-ranking";

/** Ranking de alunos por ciclo — custoso; cache breve para várias rotas (dashboard admin/prof, ranking). */
export async function getCachedStudentGamificationRankingFull(cycleId?: string) {
  const key = cycleId ?? "all";
  return unstable_cache(
    () =>
      computeStudentGamificationRanking({
        nameMode: "full",
        ...(cycleId ? { cycleId } : {}),
      }),
    ["student-gamification-ranking-full-v2", key],
    { revalidate: 90 },
  )();
}

/** Feriados/eventos ativos — iguais para todos os utilizadores. */
export async function getCachedActiveHolidaysRows() {
  return unstable_cache(
    () =>
      prisma.holiday.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          date: true,
          recurring: true,
          eventStartTime: true,
          eventEndTime: true,
        },
      }),
    ["active-holidays-calendar-v1"],
    { revalidate: 300 },
  )();
}
