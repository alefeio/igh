import "server-only";

import { prisma } from "@/lib/prisma";

/** Números de ciclo usados para montar a lista de cursos da pré-inscrição. */
export const NEXT_CYCLE_INTEREST_SOURCE_CYCLES = [1, 2, 3] as const;

const courseEligibleForInterestWhere = {
  status: { not: "INACTIVE" as const },
  NOT: { name: { contains: "(10h)", mode: "insensitive" as const } },
  classGroups: {
    some: {
      status: { not: "CANCELADA" as const },
      cycle: { cycle: { in: [...NEXT_CYCLE_INTEREST_SOURCE_CYCLES] } },
    },
  },
};

/**
 * Cursos que já tiveram turma (não cancelada) nos ciclos 1, 2 ou 3.
 * Exclui cursos Inativos e nomes com "(10h)".
 */
export async function listCoursesFromPastCyclesForInterest() {
  return prisma.course.findMany({
    where: courseEligibleForInterestWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Valida se um courseId pode ser escolhido no formulário de pré-inscrição. */
export async function findEligibleCourseForInterest(courseId: string) {
  return prisma.course.findFirst({
    where: { id: courseId, ...courseEligibleForInterestWhere },
    select: { id: true, name: true },
  });
}
