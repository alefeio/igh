import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Usuários que podem ser responsáveis por polo:
 * - papel-base Coordenador de Polos; ou
 * - overlay isPoloCoordinator (ex.: Admin Geral promovido mantendo o vínculo); ou
 * - já responsável por algum polo (FK), para não sumir da lista após promoção.
 */
export const poloCoordinatorEligibleWhere: Prisma.UserWhereInput = {
  isActive: true,
  OR: [
    { role: "POLO_COORDINATOR" },
    { isPoloCoordinator: true },
    { coordinatedPolos: { some: {} } },
  ],
};

export function userKeepsPoloCoordinatorAccess(user: {
  role: string;
  isPoloCoordinator?: boolean;
}): boolean {
  return user.role === "POLO_COORDINATOR" || !!user.isPoloCoordinator;
}
