import "server-only";

import { cachedDirector } from "@/lib/diretor/cache";
import { occupancyPercent as occupancyPct } from "@/lib/diretor/metrics/offer-formulas";
import type { OfferExecutiveFacts } from "@/lib/diretor/facts/types";
import type { ScopeResolution } from "@/lib/diretor/load-scope";
import { prisma } from "@/lib/prisma";

async function loadOfferFactsUncached(scope: ScopeResolution): Promise<OfferExecutiveFacts> {
  const quality: OfferExecutiveFacts["quality"] = [];
  const qualityNotes: string[] = [];
  const cgIds = scope.classGroupIds;
  if (cgIds.length === 0) {
    return {
      occupancyPercent: null,
      emptyClasses: 0,
      below30: 0,
      waitlist: 0,
      periodLabel: scope.cycleLabel,
      quality: [{ domain: "offer", status: "unavailable", note: "Nenhuma turma no recorte." }],
      qualityNotes: [],
    };
  }

  const groups = await prisma.classGroup.findMany({
    where: { id: { in: cgIds }, status: { in: ["ABERTA", "EM_ANDAMENTO"] } },
    select: { id: true, capacity: true },
  });
  const occRows = await prisma.enrollment.groupBy({
    by: ["classGroupId"],
    where: { classGroupId: { in: cgIds }, status: { in: ["ACTIVE", "SUSPENDED"] } },
    _count: { id: true },
  });
  const occByCg = new Map(occRows.map((r) => [r.classGroupId, r._count.id]));
  let capacity = 0;
  let occupied = 0;
  let emptyClasses = 0;
  let below30 = 0;
  for (const g of groups) {
    capacity += g.capacity;
    const occ = occByCg.get(g.id) ?? 0;
    occupied += occ;
    const pct = occupancyPct(occ, g.capacity);
    if (occ === 0) emptyClasses += 1;
    else if (pct != null && pct < 30) below30 += 1;
  }
  const waitlist = await prisma.enrollmentWaitlist.count({
    where: { classGroupId: { in: cgIds }, status: "WAITING" },
  });
  if (quality.length === 0) quality.push({ domain: "offer", status: "ok" });
  return {
    occupancyPercent: occupancyPct(occupied, capacity),
    emptyClasses,
    below30,
    waitlist,
    periodLabel: scope.cycleLabel,
    quality,
    qualityNotes,
  };
}

export async function loadOfferExecutiveFacts(scope: ScopeResolution, viewer: "DIRECTOR" | "MASTER") {
  return cachedDirector(["facts-offer-v2", scope.scope, scope.cycleId, viewer], () => loadOfferFactsUncached(scope));
}
