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

/**
 * Garante um ciclo utilizável em bases novas.
 * Não sobrescreve nem conflita com um ciclo 1/2026 já criado com outro id
 * (@@unique([cycle, year])).
 */
export async function ensureDefaultCycle(
  prisma: Pick<PrismaClient, "cycle">,
): Promise<{ id: string }> {
  const byId = await prisma.cycle.findUnique({
    where: { id: DEFAULT_CYCLE_ID },
    select: { id: true },
  });
  if (byId) return byId;

  const byKey = await prisma.cycle.findUnique({
    where: { cycle_year: { cycle: 1, year: 2026 } },
    select: { id: true },
  });
  if (byKey) return byKey;

  try {
    return await prisma.cycle.create({
      data: {
        id: DEFAULT_CYCLE_ID,
        cycle: 1,
        year: 2026,
        isVisibleForEnrollments: true,
      },
      select: { id: true },
    });
  } catch {
    const fallback = await prisma.cycle.findFirst({
      where: {
        OR: [{ id: DEFAULT_CYCLE_ID }, { cycle: 1, year: 2026 }],
      },
      select: { id: true },
    });
    if (fallback) return fallback;
    throw new Error("Não foi possível garantir o ciclo padrão.");
  }
}
