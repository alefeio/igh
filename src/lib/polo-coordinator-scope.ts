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

/**
 * Escopo de turmas do coordenador de polo:
 * - turmas com `poloLocation` de um polo que ele coordena; ou
 * - turmas cujo texto `location` coincide com o nome de um local desses polos
 *   (compatível com turmas antigas sem `poloLocationId`).
 */
export async function buildClassGroupWhereForPoloCoordinator(
  userId: string,
): Promise<Prisma.ClassGroupWhereInput> {
  const polos = await prisma.polo.findMany({
    where: { coordinatorUserId: userId },
    select: {
      id: true,
      locations: { select: { name: true } },
    },
  });

  if (polos.length === 0) {
    return { id: { in: [] } };
  }

  const poloIds = polos.map((p) => p.id);
  const locationNames = Array.from(
    new Set(
      polos.flatMap((p) =>
        p.locations.map((l) => l.name.trim()).filter((n) => n.length > 0),
      ),
    ),
  );

  const or: Prisma.ClassGroupWhereInput[] = [
    { poloLocation: { poloId: { in: poloIds } } },
  ];

  for (const name of locationNames) {
    or.push({ location: { equals: name, mode: "insensitive" } });
  }

  return { OR: or };
}

export async function buildEnrollmentWhereForPoloCoordinator(
  userId: string,
): Promise<Prisma.EnrollmentWhereInput> {
  return {
    classGroup: await buildClassGroupWhereForPoloCoordinator(userId),
  };
}

/** @deprecated Prefer `buildClassGroupWhereForPoloCoordinator` (async, escopo completo). */
export function classGroupWhereForPoloCoordinator(userId: string): Prisma.ClassGroupWhereInput {
  return {
    poloLocation: {
      polo: {
        coordinatorUserId: userId,
      },
    },
  };
}

/** @deprecated Prefer `buildEnrollmentWhereForPoloCoordinator`. */
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
  const where = await buildClassGroupWhereForPoloCoordinator(userId);
  const cg = await prisma.classGroup.findFirst({
    where: {
      id: classGroupId,
      ...where,
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
  const where = await buildEnrollmentWhereForPoloCoordinator(userId);
  const row = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      ...where,
    },
    select: { id: true },
  });
  return !!row;
}
