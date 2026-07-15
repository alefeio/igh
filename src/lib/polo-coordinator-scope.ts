import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** IDs dos polos em que o usuário é coordenador. */
export async function getCoordinatedPoloIds(userId: string): Promise<string[]> {
  const rows = await prisma.polo.findMany({
    where: { coordinatorUserId: userId, isActive: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Filtro Prisma de turmas pertencentes aos polos do coordenador. */
export function classGroupWhereForPoloCoordinator(userId: string): Prisma.ClassGroupWhereInput {
  return {
    poloLocation: {
      isActive: true,
      polo: {
        isActive: true,
        coordinatorUserId: userId,
      },
    },
  };
}

/** Filtro Prisma de matrículas nas turmas dos polos do coordenador. */
export function enrollmentWhereForPoloCoordinator(userId: string): Prisma.EnrollmentWhereInput {
  return {
    classGroup: classGroupWhereForPoloCoordinator(userId),
  };
}

/** Verifica se a turma pertence a um polo coordenado pelo usuário. */
export async function poloCoordinatorOwnsClassGroup(
  userId: string,
  classGroupId: string,
): Promise<boolean> {
  const cg = await prisma.classGroup.findFirst({
    where: {
      id: classGroupId,
      ...classGroupWhereForPoloCoordinator(userId),
    },
    select: { id: true },
  });
  return !!cg;
}

/** Verifica se a matrícula está em turma de polo do coordenador. */
export async function poloCoordinatorOwnsEnrollment(
  userId: string,
  enrollmentId: string,
): Promise<boolean> {
  const row = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      ...enrollmentWhereForPoloCoordinator(userId),
    },
    select: { id: true },
  });
  return !!row;
}
