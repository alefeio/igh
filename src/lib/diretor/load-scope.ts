import "server-only";

import { pickCurrentCycle } from "@/lib/cycles";
import { formatCycleLabel } from "@/lib/gamification-cycle";
import { prisma } from "@/lib/prisma";

export type DirectorScopeMode = "current" | "all" | "cycle";

export type ScopeResolution = {
  scope: DirectorScopeMode;
  cycleId: string | null;
  cycleLabel: string;
  classGroupIds: string[];
  cycles: Array<{ id: string; label: string; isCurrent: boolean }>;
  dataAsOf: Date;
};

export async function resolveDirectorScope(opts: {
  scope: DirectorScopeMode;
  cycleId?: string | null;
  dataAsOf?: Date;
}): Promise<ScopeResolution> {
  const dataAsOf = opts.dataAsOf ?? new Date();
  const cyclesRaw = await prisma.cycle.findMany({
    orderBy: [{ year: "desc" }, { cycle: "desc" }],
    select: { id: true, year: true, cycle: true },
  });
  const current = pickCurrentCycle(cyclesRaw);
  const cycles = cyclesRaw.map((c) => ({
    id: c.id,
    label: formatCycleLabel(c),
    isCurrent: current?.id === c.id,
  }));

  let cycleId: string | null = null;
  let cycleLabel = "Relatório geral (todos os ciclos)";
  let classGroupWhere: { cycleId?: string; status?: { not: "CANCELADA" } } = {
    status: { not: "CANCELADA" },
  };

  if (opts.scope === "all") {
    cycleId = null;
    cycleLabel = "Relatório geral (todos os ciclos)";
  } else if (opts.scope === "cycle" && opts.cycleId) {
    cycleId = opts.cycleId;
    cycleLabel = cycles.find((c) => c.id === cycleId)?.label ?? "Ciclo";
    classGroupWhere = { cycleId, status: { not: "CANCELADA" } };
  } else {
    cycleId = current?.id ?? null;
    cycleLabel = current ? formatCycleLabel(current) : "Sem ciclo atual";
    if (cycleId) classGroupWhere = { cycleId, status: { not: "CANCELADA" } };
  }

  const groups = await prisma.classGroup.findMany({
    where: classGroupWhere,
    select: { id: true },
  });

  return {
    scope: opts.scope,
    cycleId,
    cycleLabel,
    classGroupIds: groups.map((g) => g.id),
    cycles,
    dataAsOf,
  };
}
