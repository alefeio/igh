import "server-only";

import { FORMULA_VERSION_1B } from "@/lib/diretor/catalog/definitions";
import { cachedDirector } from "@/lib/diretor/cache";
import { metricCard } from "@/lib/diretor/metrics/metric-card";
import {
  agingBucket,
  isOverdue,
  isOpenPayableOrReceivable,
  isPaidWithoutPaidAt,
  netPaidMovementCents,
  paidInPeriod,
  postedInPeriod,
  sumCents,
  ymKey,
  type FinRow,
} from "@/lib/diretor/metrics/financial-formulas";
import { resolvePeriod } from "@/lib/diretor/period";
import type { DerivedAlertDto, MetricValueDto, ResponseMetaDto } from "@/lib/diretor/schemas/common";
import { prisma } from "@/lib/prisma";

export type FinancialFilters = {
  competence?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  poloId?: string;
};

export type FinancialBundle = {
  meta: ResponseMetaDto;
  kpis: MetricValueDto[];
  disclaimer: string;
  movement: {
    postedInCents: number;
    postedOutCents: number;
    paidInCents: number;
    paidOutCents: number;
    netPaidCents: number;
  };
  apAr: {
    apCents: number;
    arCents: number;
    overdueCents: number;
    aging: Array<{ bucket: string; amountCents: number }>;
  };
  byCategory: Array<{ name: string; kind: string; amountCents: number }>;
  byNature: Array<{ nature: string; amountCents: number }>;
  byPolo: Array<{ name: string; amountCents: number }>;
  monthlyPaid: Array<{ month: string; paidInCents: number; paidOutCents: number }>;
  payroll: {
    competence: string | null;
    status: string | null;
    pendingLines: number;
    paidLines: number;
    amountCents: number;
    incomplete: boolean;
  };
  alerts: DerivedAlertDto[];
  qualityNotes: string[];
};

export type FinancialSummary = {
  netPaidCents: number;
  overdueCents: number;
  qualityNotes: string[];
  quality: ResponseMetaDto["quality"];
  alerts: DerivedAlertDto[];
};

async function loadFinancialUncached(
  filters: FinancialFilters,
  viewer: "DIRECTOR" | "MASTER",
  asOf = new Date(),
): Promise<FinancialBundle> {
  const period = resolvePeriod({ ...filters, asOf });
  const qualityNotes: string[] = [];
  const quality: ResponseMetaDto["quality"] = [];

  const raw = await prisma.financialEntry.findMany({
    where: {
      deletedAt: null,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.poloId ? { poloId: filters.poloId } : {}),
      OR: [
        { entryDate: { gte: period.from, lte: period.to } },
        { paidAt: { gte: period.from, lte: period.to } },
        { paymentStatus: { in: ["EM_ABERTO", "PENDENTE"] } },
        { paymentStatus: "PAGO", paidAt: null },
      ],
    },
    select: {
      kind: true,
      amountCents: true,
      entryDate: true,
      paidAt: true,
      paymentStatus: true,
      categoryId: true,
      poloId: true,
      expenseNature: true,
      deletedAt: true,
      category: { select: { name: true } },
      polo: { select: { name: true } },
    },
  });

  const rows: Array<FinRow & { categoryName: string | null; poloName: string | null }> = raw.map((r) => ({
    kind: r.kind,
    amountCents: r.amountCents,
    entryDate: r.entryDate,
    paidAt: r.paidAt,
    paymentStatus: r.paymentStatus,
    categoryId: r.categoryId,
    poloId: r.poloId,
    expenseNature: r.expenseNature,
    deletedAt: r.deletedAt,
    categoryName: r.category?.name ?? null,
    poloName: r.polo?.name ?? null,
  }));

  const posted = rows.filter((r) => postedInPeriod(r, period.from, period.to));
  const paid = rows.filter((r) => paidInPeriod(r, period.from, period.to));
  const postedIn = posted.filter((r) => r.kind === "ENTRADA");
  const postedOut = posted.filter((r) => r.kind === "SAIDA");
  const paidIn = paid.filter((r) => r.kind === "ENTRADA");
  const paidOut = paid.filter((r) => r.kind === "SAIDA");

  const postedInCents = sumCents(postedIn);
  const postedOutCents = sumCents(postedOut);
  const paidInCents = sumCents(paidIn);
  const paidOutCents = sumCents(paidOut);
  const netPaidCents = netPaidMovementCents(paidInCents, paidOutCents);

  const open = rows.filter((r) => isOpenPayableOrReceivable(r.paymentStatus));
  const ap = open.filter((r) => r.kind === "SAIDA");
  const ar = open.filter((r) => r.kind === "ENTRADA");
  const overdue = open.filter((r) => isOverdue(r, asOf));

  const paidNoDate = rows.filter(isPaidWithoutPaidAt).length;
  const noCategory = posted.filter((r) => !r.categoryId).length;
  const noPolo = filters.poloId ? 0 : posted.filter((r) => !r.poloId).length;

  if (paidNoDate > 0) {
    qualityNotes.push(`${paidNoDate} lançamento(s) PAGO sem paidAt — excluídos do critério de pagamento.`);
    quality.push({ domain: "financial", status: "partial", note: "Pago sem data de pagamento." });
  }
  if (noCategory > 0) {
    qualityNotes.push(`${noCategory} lançamento(s) do período sem categoria.`);
    quality.push({ domain: "financial", status: "partial", note: "Lançamento sem categoria." });
  }
  if (filters.poloId && posted.some((r) => !r.poloId)) {
    qualityNotes.push("Há lançamentos sem polo no recorte que exige polo.");
    quality.push({ domain: "financial", status: "partial", note: "Lançamento sem polo." });
  } else if (noPolo > 0) {
    qualityNotes.push(`${noPolo} lançamento(s) do período sem polo (agregado em “Sem polo”).`);
  }
  if (quality.length === 0) quality.push({ domain: "financial", status: "ok" });

  const byCatMap = new Map<string, { name: string; kind: string; amountCents: number }>();
  for (const r of posted) {
    const name = r.categoryName ?? "Sem categoria";
    const key = `${r.kind}:${name}`;
    const cur = byCatMap.get(key) ?? { name, kind: r.kind, amountCents: 0 };
    cur.amountCents += r.amountCents;
    byCatMap.set(key, cur);
  }
  const byNatureMap = new Map<string, number>();
  for (const r of postedOut) {
    const n = r.expenseNature ?? "não informado";
    byNatureMap.set(n, (byNatureMap.get(n) ?? 0) + r.amountCents);
  }
  const byPoloMap = new Map<string, number>();
  for (const r of posted) {
    const n = r.poloName ?? "Sem polo";
    byPoloMap.set(n, (byPoloMap.get(n) ?? 0) + r.amountCents);
  }

  const monthMap = new Map<string, { paidInCents: number; paidOutCents: number }>();
  for (const r of paid) {
    const k = ymKey(r.paidAt!);
    const cur = monthMap.get(k) ?? { paidInCents: 0, paidOutCents: 0 };
    if (r.kind === "ENTRADA") cur.paidInCents += r.amountCents;
    else cur.paidOutCents += r.amountCents;
    monthMap.set(k, cur);
  }

  const agingMap = new Map<string, number>();
  for (const r of open) {
    const b = agingBucket(r.entryDate, asOf);
    agingMap.set(b, (agingMap.get(b) ?? 0) + r.amountCents);
  }

  const payrollMonth = period.competence
    ? await prisma.payrollMonth.findFirst({
        where: { referenceMonth: period.from },
        include: { _count: { select: { lines: true } }, lines: { select: { paymentStatus: true, amountCents: true } } },
      })
    : await prisma.payrollMonth.findFirst({
        orderBy: { referenceMonth: "desc" },
        include: { _count: { select: { lines: true } }, lines: { select: { paymentStatus: true, amountCents: true } } },
      });

  const payrollIncomplete = !payrollMonth || payrollMonth.lines.length === 0;
  if (payrollIncomplete) {
    qualityNotes.push("Competência de folha incompleta ou inexistente no recorte.");
    quality.push({ domain: "financial", status: "partial", note: "Folha incompleta." });
  }

  const href = "/diretor/financeiro";
  const kpis: MetricValueDto[] = [
    metricCard("fin.posted.in", postedInCents, { quality: "ok", href }),
    metricCard("fin.paid.in", paidInCents, { quality: paidNoDate ? "partial" : "ok", href }),
    metricCard("fin.posted.out", postedOutCents, { quality: "ok", href }),
    metricCard("fin.paid.out", paidOutCents, { quality: paidNoDate ? "partial" : "ok", href }),
    metricCard("fin.net.paid", netPaidCents, { quality: "ok", href }),
    metricCard("fin.overdue", sumCents(overdue), { quality: "ok", href }),
  ];

  const alerts: DerivedAlertDto[] = [];
  const overdueCents = sumCents(overdue);
  if (overdueCents > 0) {
    alerts.push({
      id: "fin-overdue",
      ruleId: "fin.overdue_open",
      ruleVersion: FORMULA_VERSION_1B,
      domain: "financial",
      severity: "attention",
      title: "Pagamentos ou recebimentos vencidos",
      fact: `${overdueCents} centavos em lançamentos abertos vencidos (critério entryDate / PENDENTE).`,
      value: overdueCents,
      period: period.label,
      impact: "Obrigações ou recebíveis em atraso.",
      suggestedDecision: "Priorizar regularização dos vencidos com a gerência.",
      href,
      source: "FinancialEntry.paymentStatus + entryDate",
      status: "não acompanhado pelo sistema",
    });
  }
  if (payrollMonth && payrollMonth.lines.some((l) => l.paymentStatus === "PENDENTE")) {
    const n = payrollMonth.lines.filter((l) => l.paymentStatus === "PENDENTE").length;
    alerts.push({
      id: "fin-payroll-pending",
      ruleId: "fin.payroll_pending",
      ruleVersion: FORMULA_VERSION_1B,
      domain: "financial",
      severity: "attention",
      title: "Folha com linhas pendentes",
      fact: `${n} linha(s) PENDENTE na competência de folha.`,
      value: n,
      period: period.label,
      impact: "Folha não liquidada integralmente.",
      suggestedDecision: "Acompanhar fechamento/pagamento da folha.",
      href,
      source: "PayrollLine.paymentStatus",
      status: "não acompanhado pelo sistema",
    });
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      dataAsOf: asOf.toISOString(),
      filters: { ...filters, periodFrom: period.from.toISOString(), periodTo: period.to.toISOString(), dateBasisPosted: "entryDate", dateBasisPaid: "paidAt" },
      quality,
      formulaVersion: FORMULA_VERSION_1B,
      viewer,
    },
    kpis,
    disclaimer:
      "Com base nos lançamentos registrados como pagos. Não representa saldo ou disponibilidade bancária.",
    movement: { postedInCents, postedOutCents, paidInCents, paidOutCents, netPaidCents },
    apAr: {
      apCents: sumCents(ap),
      arCents: sumCents(ar),
      overdueCents,
      aging: [...agingMap.entries()].map(([bucket, amountCents]) => ({ bucket, amountCents })),
    },
    byCategory: [...byCatMap.values()],
    byNature: [...byNatureMap.entries()].map(([nature, amountCents]) => ({ nature, amountCents })),
    byPolo: [...byPoloMap.entries()].map(([name, amountCents]) => ({ name, amountCents })),
    monthlyPaid: [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v })),
    payroll: {
      competence: payrollMonth ? payrollMonth.referenceMonth.toISOString().slice(0, 7) : null,
      status: payrollMonth?.status ?? null,
      pendingLines: payrollMonth?.lines.filter((l) => l.paymentStatus === "PENDENTE").length ?? 0,
      paidLines: payrollMonth?.lines.filter((l) => l.paymentStatus === "PAGO").length ?? 0,
      amountCents: payrollMonth ? sumCents(payrollMonth.lines) : 0,
      incomplete: payrollIncomplete,
    },
    alerts,
    qualityNotes,
  };
}

export async function loadFinancial(
  filters: FinancialFilters,
  viewer: "DIRECTOR" | "MASTER",
): Promise<FinancialBundle> {
  return cachedDirector(
    ["financial", filters.competence, filters.from, filters.to, filters.categoryId, filters.poloId, viewer],
    () => loadFinancialUncached(filters, viewer),
  );
}

export async function summarizeFinancial(
  filters: FinancialFilters,
  viewer: "DIRECTOR" | "MASTER",
): Promise<FinancialSummary> {
  const b = await loadFinancial(filters, viewer);
  return {
    netPaidCents: b.movement.netPaidCents,
    overdueCents: b.apAr.overdueCents,
    qualityNotes: b.qualityNotes,
    quality: b.meta.quality,
    alerts: b.alerts,
  };
}
