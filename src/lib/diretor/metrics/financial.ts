import "server-only";

import { FORMULA_VERSION_1B, FORMULA_VERSION_1C } from "@/lib/diretor/catalog/definitions";
import { cachedDirector } from "@/lib/diretor/cache";
import { metricCard } from "@/lib/diretor/metrics/metric-card";
import {
  isOpenPayableOrReceivable,
  isPaidWithoutPaidAt,
  netPaidMovementCents,
  openAgeBucket,
  OPEN_AGE_BUCKET_LABEL,
  OPEN_AGE_CHART_LABEL,
  paidInPeriod,
  postedInPeriod,
  sumCents,
  ymKey,
  type FinRow,
} from "@/lib/diretor/metrics/financial-formulas";
import { resolvePeriod } from "@/lib/diretor/period";
import type { DerivedAlertDto, MetricValueDto, ResponseMetaDto } from "@/lib/diretor/schemas/common";
import { formatCentsBRL } from "@/lib/employees";
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
    aging: Array<{ bucket: string; label: string; amountCents: number }>;
    openAge91PlusCents: number;
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
  openAge91PlusCents: number;
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
  const age91 = open.filter((r) => openAgeBucket(r.entryDate, asOf) === "d91_plus");

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
    const b = openAgeBucket(r.entryDate, asOf);
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
    metricCard("fin.open.age_91", sumCents(age91), { quality: "ok", href }),
  ];

  const alerts: DerivedAlertDto[] = [];
  const openAge91PlusCents = sumCents(age91);
  if (openAge91PlusCents > 0) {
    alerts.push({
      id: "fin-open-age-90",
      ruleId: "fin.open_age_91",
      ruleVersion: FORMULA_VERSION_1C,
      domain: "financial",
      severity: "attention",
      title: "Lançamentos em aberto há mais de 90 dias",
      fact: `Existem lançamentos em aberto há mais de 90 dias (${formatCentsBRL(openAge91PlusCents)}). Solicite à equipe financeira a revisão desses registros.`,
      value: openAge91PlusCents,
      period: period.label,
      impact: "Registro aberto há muito tempo — não significa vencimento nem atraso contratual.",
      suggestedDecision: "Solicitar à equipe financeira a revisão da situação desses registros.",
      href,
      source: "lançamentos financeiros",
      status: "Acompanhamento operacional ainda não registrado.",
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
      fact: `${n} linha(s) da folha ainda pendentes de pagamento.`,
      value: n,
      period: period.label,
      impact: "Folha não liquidada integralmente.",
      suggestedDecision: "Acompanhar fechamento/pagamento da folha.",
      href,
      source: "folha de pagamento",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      dataAsOf: asOf.toISOString(),
      filters: {
        competence: period.competence ?? filters.competence,
        from: filters.from,
        to: filters.to,
        categoryId: filters.categoryId,
        poloId: filters.poloId,
      },
      quality,
      formulaVersion: FORMULA_VERSION_1C,
      viewer,
    },
    kpis,
    disclaimer:
      "Com base nos lançamentos registrados como pagos. Não representa saldo ou disponibilidade bancária.",
    movement: { postedInCents, postedOutCents, paidInCents, paidOutCents, netPaidCents },
    apAr: {
      apCents: sumCents(ap),
      arCents: sumCents(ar),
      openAge91PlusCents,
      aging: [...agingMap.entries()].map(([bucket, amountCents]) => ({
        bucket,
        label: OPEN_AGE_CHART_LABEL[bucket as keyof typeof OPEN_AGE_CHART_LABEL] ?? OPEN_AGE_BUCKET_LABEL[bucket as keyof typeof OPEN_AGE_BUCKET_LABEL] ?? bucket,
        amountCents,
      })),
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
    openAge91PlusCents: b.apAr.openAge91PlusCents,
    qualityNotes: b.qualityNotes,
    quality: b.meta.quality,
    alerts: b.alerts,
  };
}
