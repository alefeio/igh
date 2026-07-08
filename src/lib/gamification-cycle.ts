import "server-only";

import { DEFAULT_CYCLE_ID } from "@/lib/cycles";
import { prisma } from "@/lib/prisma";

export type CycleOption = {
  id: string;
  cycle: number;
  year: number;
  isVisibleForEnrollments: boolean;
  label: string;
};

export function formatCycleLabel(c: { cycle: number; year: number; isVisibleForEnrollments?: boolean }): string {
  const base = `Ciclo ${c.cycle} / ${c.year}`;
  if (c.isVisibleForEnrollments === false) return `${base} (oculto)`;
  return base;
}

export async function listCyclesForGamification(): Promise<CycleOption[]> {
  const cycles = await prisma.cycle.findMany({
    orderBy: [{ year: "desc" }, { cycle: "desc" }],
  });
  return cycles.map((c) => ({
    id: c.id,
    cycle: c.cycle,
    year: c.year,
    isVisibleForEnrollments: c.isVisibleForEnrollments,
    label: formatCycleLabel(c),
  }));
}

/**
 * Resolve o ciclo usado em rankings/gamificação.
 * Preferência: id pedido (se existir) → ciclo mais recente → DEFAULT_CYCLE_ID.
 */
export async function resolveGamificationCycleId(requested?: string | null): Promise<string> {
  const cycles = await prisma.cycle.findMany({
    orderBy: [{ year: "desc" }, { cycle: "desc" }],
    select: { id: true },
  });
  if (cycles.length === 0) return DEFAULT_CYCLE_ID;
  if (requested && cycles.some((c) => c.id === requested)) return requested;
  return cycles[0]!.id;
}

export async function getGamificationCycleContext(requested?: string | null): Promise<{
  cycleId: string;
  cycles: CycleOption[];
  selected: CycleOption | null;
}> {
  const cycles = await listCyclesForGamification();
  const cycleId = await resolveGamificationCycleId(requested);
  const selected = cycles.find((c) => c.id === cycleId) ?? null;
  return { cycleId, cycles, selected };
}
