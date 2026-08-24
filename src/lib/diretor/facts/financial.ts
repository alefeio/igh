import "server-only";

import { cachedDirector } from "@/lib/diretor/cache";
import {
  isOpenPayableOrReceivable,
  netPaidMovementCents,
  openAgeBucket,
  paidInPeriod,
  type FinRow,
} from "@/lib/diretor/metrics/financial-formulas";
import { resolvePeriod } from "@/lib/diretor/period";
import type { FinancialExecutiveFacts } from "@/lib/diretor/facts/types";
import { prisma } from "@/lib/prisma";

async function loadFinancialFactsUncached(
  competence: string | undefined,
  asOf: Date,
): Promise<FinancialExecutiveFacts> {
  const period = resolvePeriod({ competence, asOf });
  const raw = await prisma.financialEntry.findMany({
    where: {
      deletedAt: null,
      OR: [
        { paidAt: { gte: period.from, lte: period.to } },
        { paymentStatus: { in: ["EM_ABERTO", "PENDENTE"] } },
      ],
    },
    select: {
      kind: true,
      amountCents: true,
      entryDate: true,
      paidAt: true,
      paymentStatus: true,
      deletedAt: true,
      categoryId: true,
      poloId: true,
      expenseNature: true,
    },
  });
  const rows = raw as FinRow[];
  const paid = rows.filter((r) => paidInPeriod(r, period.from, period.to));
  const paidIn = paid.filter((r) => r.kind === "ENTRADA");
  const paidOut = paid.filter((r) => r.kind === "SAIDA");
  const open = rows.filter((r) => isOpenPayableOrReceivable(r.paymentStatus));
  const apCents = open.filter((r) => r.kind === "SAIDA").reduce((a, r) => a + r.amountCents, 0);
  const arCents = open.filter((r) => r.kind === "ENTRADA").reduce((a, r) => a + r.amountCents, 0);
  const openAge91PlusCents = open
    .filter((r) => openAgeBucket(r.entryDate, asOf) === "d91_plus")
    .reduce((a, r) => a + r.amountCents, 0);
  return {
    netPaidCents: netPaidMovementCents(
      paidIn.reduce((a, r) => a + r.amountCents, 0),
      paidOut.reduce((a, r) => a + r.amountCents, 0),
    ),
    apCents,
    arCents,
    openAge91PlusCents,
    periodLabel: period.label,
    quality: [{ domain: "financial", status: "ok" }],
    qualityNotes: [],
  };
}

export async function loadFinancialExecutiveFacts(
  filters: { competence?: string },
  viewer: "DIRECTOR" | "MASTER",
  asOf = new Date(),
) {
  return cachedDirector(["facts-financial", filters.competence, viewer, asOf.toISOString().slice(0, 10)], () =>
    loadFinancialFactsUncached(filters.competence, asOf),
  );
}
