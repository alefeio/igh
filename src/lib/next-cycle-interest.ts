import "server-only";

import { prisma } from "@/lib/prisma";

/** Números de ciclo usados para montar a lista de cursos da pré-inscrição. */
export const NEXT_CYCLE_INTEREST_SOURCE_CYCLES = [1, 2, 3] as const;

/**
 * Cursos que já tiveram turma (não cancelada) nos ciclos 1, 2 ou 3.
 */
export async function listCoursesFromPastCyclesForInterest() {
  return prisma.course.findMany({
    where: {
      classGroups: {
        some: {
          status: { not: "CANCELADA" },
          cycle: { cycle: { in: [...NEXT_CYCLE_INTEREST_SOURCE_CYCLES] } },
        },
      },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
