import "server-only";

import { missingRequiredDocuments } from "@/lib/employees";
import { FORMULA_VERSION_1B } from "@/lib/diretor/catalog/definitions";
import { cachedDirector } from "@/lib/diretor/cache";
import { metricCard } from "@/lib/diretor/metrics/metric-card";
import {
  contractHorizon,
  daysSince,
  inventoryStockBand,
  isStaleMovement,
} from "@/lib/diretor/metrics/admin-formulas";
import { resolvePeriod } from "@/lib/diretor/period";
import type { DerivedAlertDto, MetricValueDto, ResponseMetaDto } from "@/lib/diretor/schemas/common";
import { prisma } from "@/lib/prisma";

export type AdminFilters = { competence?: string; from?: string; to?: string };

export type AdministrativeBundle = {
  meta: ResponseMetaDto;
  kpis: MetricValueDto[];
  people: {
    activeEmployees: number;
    pendingDocuments: number;
    contractsExpired: number;
    contractsD30: number;
    contractsD60: number;
    contractsD90: number;
    payroll: { status: string | null; pendingLines: number; paidLines: number };
    mealTickets: { pending: number; confirmed: number };
  };
  inventory: {
    belowMin: number;
    zero: number;
    aboveMin: number;
    stale: number;
    byCategory: Array<{ category: string; items: number; quantity: number }>;
  };
  comms: {
    failedOutbox: number;
    campaignsWithFailures: number;
    affectedRecipients: number;
    oldestFailureAgeDays: number | null;
  };
  charts: {
    contractHorizon: Array<{ bucket: string; count: number }>;
    inventoryCritical: Array<{ category: string; belowMin: number; zero: number }>;
    commsFailures: Array<{ day: string; failed: number }>;
  };
  alerts: DerivedAlertDto[];
  qualityNotes: string[];
};

async function loadAdministrativeUncached(
  filters: AdminFilters,
  viewer: "DIRECTOR" | "MASTER",
  asOf = new Date(),
): Promise<AdministrativeBundle> {
  const period = resolvePeriod({ ...filters, asOf });
  const qualityNotes: string[] = [];
  const quality: ResponseMetaDto["quality"] = [];

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, status: "ATIVO" },
    select: {
      id: true,
      employmentType: true,
      documents: { where: { deletedAt: null }, select: { type: true } },
    },
  });
  let pendingDocuments = 0;
  for (const e of employees) {
    if (missingRequiredDocuments(e.employmentType, e.documents.map((d) => d.type)).length > 0) {
      pendingDocuments += 1;
    }
  }

  const contracts = await prisma.employeeContract.findMany({
    where: { deletedAt: null, status: "ATIVO", kind: "CONTRATO" },
    select: { endDate: true },
  });
  let contractsExpired = 0;
  let contractsD30 = 0;
  let contractsD60 = 0;
  let contractsD90 = 0;
  const horizonCounts = { expired: 0, d30: 0, d60: 0, d90: 0, later: 0, open: 0 };
  for (const c of contracts) {
    const h = contractHorizon(c.endDate, asOf);
    horizonCounts[h] += 1;
    if (h === "expired") contractsExpired += 1;
    if (h === "d30") contractsD30 += 1;
    if (h === "d60") contractsD60 += 1;
    if (h === "d90") contractsD90 += 1;
  }

  const payrollMonth = await prisma.payrollMonth.findFirst({
    where: period.competence ? { referenceMonth: period.from } : {},
    orderBy: { referenceMonth: "desc" },
    include: { lines: { select: { paymentStatus: true } }, mealTicket: { include: { lines: { select: { status: true } } } } },
  });

  const items = await prisma.inventoryItem.findMany({
    where: { deletedAt: null, isActive: true },
    select: {
      category: true,
      quantityOnHand: true,
      minStock: true,
      movements: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  let belowMin = 0;
  let zero = 0;
  let aboveMin = 0;
  let stale = 0;
  const catMap = new Map<string, { items: number; quantity: number; belowMin: number; zero: number }>();
  for (const it of items) {
    const cat = it.category?.trim() || "Sem categoria";
    const cur = catMap.get(cat) ?? { items: 0, quantity: 0, belowMin: 0, zero: 0 };
    cur.items += 1;
    cur.quantity += it.quantityOnHand;
    const band = inventoryStockBand(it.quantityOnHand, it.minStock);
    if (band === "zero") {
      zero += 1;
      cur.zero += 1;
    } else if (band === "at_or_below_min") {
      belowMin += 1;
      cur.belowMin += 1;
    } else {
      aboveMin += 1;
    }
    const last = it.movements[0]?.createdAt ?? null;
    if (isStaleMovement(last, asOf, 90)) stale += 1;
    catMap.set(cat, cur);
  }
  if (items.some((i) => !i.category)) {
    qualityNotes.push("Há itens de estoque sem categoria.");
    quality.push({ domain: "administrative", status: "partial", note: "Estoque sem categoria." });
  }

  const failedOutbox = await prisma.emailOutbox.count({
    where: { status: "FAILED", createdAt: { gte: period.from, lte: period.to } },
  });
  const campaigns = await prisma.emailCampaign.findMany({
    where: { createdAt: { gte: period.from, lte: period.to } },
    select: { totalFailed: true },
  });
  const campaignsWithFailures = campaigns.filter((c) => c.totalFailed > 0).length;
  const affectedRecipients = await prisma.emailCampaignRecipient.count({
    where: {
      status: { in: ["FAILED", "BOUNCED", "COMPLAINED", "INVALID_EMAIL"] },
      createdAt: { gte: period.from, lte: period.to },
    },
  });
  const oldestFail = await prisma.emailOutbox.findFirst({
    where: { status: "FAILED" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const failedRows = await prisma.emailOutbox.findMany({
    where: { status: "FAILED", createdAt: { gte: period.from, lte: period.to } },
    select: { createdAt: true },
  });
  const commsMap = new Map<string, number>();
  for (const r of failedRows) {
    const d = r.createdAt.toISOString().slice(0, 10);
    commsMap.set(d, (commsMap.get(d) ?? 0) + 1);
  }

  if (quality.length === 0) quality.push({ domain: "administrative", status: "ok" });

  const href = "/diretor/administrativo";
  const alerts: DerivedAlertDto[] = [];
  if (contractsExpired > 0) {
    alerts.push({
      id: "adm-contracts-expired",
      ruleId: "adm.contracts_expired",
      ruleVersion: FORMULA_VERSION_1B,
      domain: "administrative",
      severity: "attention",
      title: "Contratos com vigência encerrada na data de referência",
      fact: `${contractsExpired} contrato(s) ATIVO com endDate anterior a dataAsOf.`,
      value: contractsExpired,
      period: "estoque",
      impact: "Vínculos sem vigência formal.",
      suggestedDecision: "Regularizar renovação ou encerramento.",
      href,
      source: "EmployeeContract.endDate",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (contractsD30 > 0) {
    alerts.push({
      id: "adm-contracts-30",
      ruleId: "adm.contracts_d30",
      ruleVersion: FORMULA_VERSION_1B,
      domain: "administrative",
      severity: "attention",
      title: "Contratos a vencer em 30 dias",
      fact: `${contractsD30} contrato(s) com vencimento em até 30 dias.`,
      value: contractsD30,
      period: "estoque",
      impact: "Risco de descontinuidade contratual.",
      suggestedDecision: "Antecipar renovação.",
      href,
      source: "EmployeeContract.endDate",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (pendingDocuments > 0) {
    alerts.push({
      id: "adm-docs",
      ruleId: "adm.pending_docs",
      ruleVersion: FORMULA_VERSION_1B,
      domain: "administrative",
      severity: "attention",
      title: "Documentos de colaboradores pendentes",
      fact: `${pendingDocuments} colaborador(es) ativo(s) com documento obrigatório ausente.`,
      value: pendingDocuments,
      period: "estoque",
      impact: "Conformidade documental incompleta.",
      suggestedDecision: "Solicitar pendências à gerência de pessoas.",
      href,
      source: "EmployeeDocument + requiredDocumentsFor",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (zero + belowMin > 0) {
    alerts.push({
      id: "adm-stock",
      ruleId: "adm.inventory_critical",
      ruleVersion: FORMULA_VERSION_1B,
      domain: "administrative",
      severity: "attention",
      title: "Estoque zerado ou abaixo do mínimo",
      fact: `${zero} item(ns) zerado(s) e ${belowMin} abaixo do mínimo.`,
      value: zero + belowMin,
      period: "estoque",
      impact: "Ruptura operacional de materiais.",
      suggestedDecision: "Reposição dos itens críticos.",
      href,
      source: "InventoryItem.quantityOnHand/minStock",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }
  if (failedOutbox + affectedRecipients > 0) {
    alerts.push({
      id: "adm-comms",
      ruleId: "adm.comms_failures",
      ruleVersion: FORMULA_VERSION_1B,
      domain: "administrative",
      severity: "attention",
      title: "Falhas relevantes de comunicação",
      fact: `${failedOutbox} falha(s) de outbox e ${affectedRecipients} destinatário(s) afetados no período (agregado).`,
      value: failedOutbox + affectedRecipients,
      period: period.label,
      impact: "Mensagens não entregues.",
      suggestedDecision: "Reprocessar filas e revisar campanhas com falha.",
      href,
      source: "EmailOutbox FAILED + EmailCampaignRecipient (agregado)",
      status: "Acompanhamento operacional ainda não registrado.",
    });
  }

  const kpis: MetricValueDto[] = [
    metricCard("adm.employees.active", employees.length, { quality: "ok", href }),
    metricCard("adm.contracts.expired", contractsExpired, { quality: "ok", href }),
    metricCard("adm.inventory.zero", zero, { quality: "ok", href }),
  ];

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      dataAsOf: asOf.toISOString(),
      filters: { ...filters, periodFrom: period.from.toISOString(), periodTo: period.to.toISOString() },
      quality,
      formulaVersion: FORMULA_VERSION_1B,
      viewer,
    },
    kpis,
    people: {
      activeEmployees: employees.length,
      pendingDocuments,
      contractsExpired,
      contractsD30,
      contractsD60,
      contractsD90,
      payroll: {
        status: payrollMonth?.status ?? null,
        pendingLines: payrollMonth?.lines.filter((l) => l.paymentStatus === "PENDENTE").length ?? 0,
        paidLines: payrollMonth?.lines.filter((l) => l.paymentStatus === "PAGO").length ?? 0,
      },
      mealTickets: {
        pending: payrollMonth?.mealTicket?.lines.filter((l) => l.status === "PENDING").length ?? 0,
        confirmed: payrollMonth?.mealTicket?.lines.filter((l) => l.status === "CONFIRMED").length ?? 0,
      },
    },
    inventory: {
      belowMin,
      zero,
      aboveMin,
      stale,
      byCategory: [...catMap.entries()].map(([category, v]) => ({
        category,
        items: v.items,
        quantity: v.quantity,
      })),
    },
    comms: {
      failedOutbox,
      campaignsWithFailures,
      affectedRecipients,
      oldestFailureAgeDays: oldestFail ? daysSince(oldestFail.createdAt, asOf) : null,
    },
    charts: {
      contractHorizon: Object.entries(horizonCounts).map(([bucket, count]) => ({ bucket, count })),
      inventoryCritical: [...catMap.entries()].map(([category, v]) => ({
        category,
        belowMin: v.belowMin,
        zero: v.zero,
      })),
      commsFailures: [...commsMap.entries()].map(([day, failed]) => ({ day, failed })),
    },
    alerts,
    qualityNotes,
  };
}

export async function loadAdministrative(filters: AdminFilters, viewer: "DIRECTOR" | "MASTER") {
  return cachedDirector(
    ["admin", filters.competence, filters.from, filters.to, viewer],
    () => loadAdministrativeUncached(filters, viewer),
  );
}

export async function summarizeAdministrative(filters: AdminFilters, viewer: "DIRECTOR" | "MASTER") {
  const b = await loadAdministrative(filters, viewer);
  return {
    contractsExpired: b.people.contractsExpired,
    pendingDocuments: b.people.pendingDocuments,
    stockCritical: b.inventory.zero + b.inventory.belowMin,
    quality: b.meta.quality,
    qualityNotes: b.qualityNotes,
    alerts: b.alerts,
  };
}
