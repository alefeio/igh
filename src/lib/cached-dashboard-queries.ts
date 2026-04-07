import "server-only";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { computeStudentGamificationRanking } from "@/lib/student-gamification-ranking";

/** Ranking global de alunos — custoso; cache breve para várias rotas (dashboard admin/prof, ranking). */
export async function getCachedStudentGamificationRankingFull() {
  return unstable_cache(
    () => computeStudentGamificationRanking({ nameMode: "full" }),
    ["student-gamification-ranking-full-v1"],
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
