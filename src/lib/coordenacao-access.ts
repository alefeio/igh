import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const COORDENACAO_ROLES = ["COORDINATOR", "DIRECTOR", "MASTER", "GENERAL_ADMIN"] as const;

export async function requireCoordenacaoViewer() {
  return requireRole([...COORDENACAO_ROLES]);
}

export function coordenacaoAuthResponse(error: unknown) {
  return authErrorResponse(error);
}

export async function listCycles() {
  return prisma.cycle.findMany({
    orderBy: [{ year: "desc" }, { cycle: "desc" }],
    select: { id: true, cycle: true, year: true, isVisibleForEnrollments: true },
  });
}

export async function resolveCycle(requested: string | null) {
  if (requested) {
    const found = await prisma.cycle.findUnique({
      where: { id: requested },
      select: { id: true, cycle: true, year: true },
    });
    if (found) return found;
  }
  const visible = await prisma.cycle.findFirst({
    where: { isVisibleForEnrollments: true },
    orderBy: [{ year: "desc" }, { cycle: "desc" }],
    select: { id: true, cycle: true, year: true },
  });
  if (visible) return visible;
  return prisma.cycle.findFirst({
    orderBy: [{ year: "desc" }, { cycle: "desc" }],
    select: { id: true, cycle: true, year: true },
  });
}
