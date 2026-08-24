import "server-only";

import { cachedDirector } from "@/lib/diretor/cache";
import { computersProgress, peopleGoalComparable } from "@/lib/diretor/metrics/social-formulas";
import { yearBounds } from "@/lib/diretor/period";
import type { SocialExecutiveFacts } from "@/lib/diretor/facts/types";
import { prisma } from "@/lib/prisma";

async function loadSocialFactsUncached(asOf: Date): Promise<SocialExecutiveFacts> {
  const year = asOf.getUTCFullYear();
  const yb = yearBounds(year);
  const [agg, goal] = await Promise.all([
    prisma.donation.aggregate({
      where: { deletedAt: null, status: "CONFIRMADA", donatedAt: { gte: yb.from, lte: yb.to } },
      _sum: { kitsCount: true },
    }),
    prisma.annualGoal.findUnique({ where: { year }, select: { computersTarget: true } }),
  ]);
  const computersDonated = agg._sum.kitsCount ?? 0;
  const computersTarget = goal?.computersTarget ?? null;
  const qualityNotes = peopleGoalComparable()
    ? []
    : ["Meta de pessoas e atendidos únicos não são equivalentes; percentual de pessoas não é calculado."];
  return {
    computersDonated,
    computersTarget,
    computersProgressPct: computersProgress(computersDonated, computersTarget ?? 0),
    periodLabel: String(year),
    quality: [{ domain: "social", status: "ok" }],
    qualityNotes,
  };
}

export async function loadSocialExecutiveFacts(viewer: "DIRECTOR" | "MASTER", asOf = new Date()) {
  return cachedDirector(["facts-social", viewer, asOf.toISOString().slice(0, 10)], () => loadSocialFactsUncached(asOf));
}
