import type { PrismaClient } from "@/generated/prisma/client";

export const DEFAULT_CYCLE_ID = "00000000-0000-0000-0000-000000000001";

export type CycleLike = { id: string; cycle: number; year: number };

/**
 * Ciclo atual: o mais recente cadastrado (maior ano e, dentro dele, maior número).
 *
 * Não usamos `isVisibleForEnrollments` porque essa flag marca o ciclo aberto para
 * inscrições, que pode ser o próximo — e não o que está em andamento.
 */
export function pickCurrentCycle<T extends CycleLike>(cycles: readonly T[]): T | null {
  let current: T | null = null;
  for (const c of cycles) {
    if (!current || c.year > current.year || (c.year === current.year && c.cycle > current.cycle)) {
      current = c;
    }
  }
  return current;
}

/** Garante o ciclo seed (1/2026) — necessário em DBs novos sem seed. */
export async function ensureDefaultCycle(
  prisma: Pick<PrismaClient, "cycle">,
): Promise<{ id: string }> {
  return prisma.cycle.upsert({
    where: { id: DEFAULT_CYCLE_ID },
    create: {
      id: DEFAULT_CYCLE_ID,
      cycle: 1,
      year: 2026,
      isVisibleForEnrollments: true,
    },
    update: {},
    select: { id: true },
  });
}
