import "server-only";

import { createAuditLog } from "@/lib/audit";
import { BRAND } from "@/lib/brand";
import { formatFiltersHuman } from "@/lib/diretor/ui-labels";
import { rowsToCsvSemicolon, safeReportFilename } from "@/lib/csv-export";
import { loadAcademic } from "@/lib/diretor/metrics/academic";
import { loadAdministrative } from "@/lib/diretor/metrics/administrative";
import { loadFinancial } from "@/lib/diretor/metrics/financial";
import { loadOffer } from "@/lib/diretor/metrics/offer";
import { loadOverviewSummaries } from "@/lib/diretor/metrics/overview";
import { loadSocialImpact } from "@/lib/diretor/metrics/social";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import { defaultCompetence } from "@/lib/diretor/period";
import { buildDirectorPdf } from "@/lib/diretor/reports/pdf";
import { buildDirectorXlsx } from "@/lib/diretor/reports/xlsx";
import type { reportsGenerateSchema } from "@/lib/diretor/search-params";
import type { z } from "zod";

export const REPORT_CATALOG = [
  { type: "executive", title: "Executivo do período", domain: "Visão Geral" },
  { type: "academic", title: "Acadêmico do ciclo", domain: "Acadêmico" },
  { type: "offer", title: "Oferta e Territórios", domain: "Oferta e Territórios" },
  { type: "social", title: "Impacto Social", domain: "Impacto Social" },
  { type: "financial", title: "Movimentação Financeira", domain: "Financeiro" },
  { type: "administrative", title: "Administrativo", domain: "Administrativo" },
] as const;

export const REPORT_MIME: Record<"json" | "csv" | "pdf" | "xlsx", string> = {
  json: "application/json",
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function envelope(title: string, payload: unknown) {
  const p = payload as {
    meta?: Record<string, unknown>;
    qualityNotes?: string[];
    alerts?: unknown[];
    kpis?: unknown;
  };
  return {
    title,
    institution: BRAND.legalName,
    brand: BRAND.shortName,
    period: p.meta?.filters ?? {},
    periodLabel: formatFiltersHuman(p.meta?.filters),
    generatedAt: typeof p.meta?.generatedAt === "string" ? p.meta.generatedAt : undefined,
    dataAsOf: typeof p.meta?.dataAsOf === "string" ? p.meta.dataAsOf : undefined,
    formulaVersion: typeof p.meta?.formulaVersion === "string" ? p.meta.formulaVersion : undefined,
    methodologyLabel: "Metodologia dos indicadores — versão 1.0",
    indicators: payload as { kpis?: Array<{ metricId?: string; label: string; value: unknown; formula?: string; quality?: string }> },
    alerts: (p.alerts ?? []) as Array<{ title?: string; fact?: string; suggestedDecision?: string; domain?: string; severity?: string }>,
    kpis: p.kpis,
    quality: p.meta?.quality ?? [],
    caveats: p.qualityNotes ?? [],
    pagination: { page: 1, pageSize: 1, total: 1 },
    disclaimer: "Geração sob demanda. Sem dados pessoais nominais. Movimentação paga não é saldo bancário.",
  };
}

export async function generateDirectorReport(
  input: z.infer<typeof reportsGenerateSchema>,
  viewer: "DIRECTOR" | "MASTER",
  userId: string,
) {
  const scope = await resolveDirectorScope({
    scope: input.scope ?? "current",
    cycleId: input.cycleId,
  });

  const competence = input.competence ?? defaultCompetence();
  let raw: unknown;
  let title = "";
  switch (input.type) {
    case "executive":
      raw = await loadOverviewSummaries({ scope, viewer, execCompetence: competence });
      title = "Relatório executivo do período";
      break;
    case "academic":
      raw = await loadAcademic(scope, {}, viewer);
      title = "Relatório acadêmico do ciclo";
      break;
    case "offer":
      raw = await loadOffer(scope, {}, viewer);
      title = "Relatório de oferta e territórios";
      break;
    case "social":
      raw = await loadSocialImpact({ from: input.from, to: input.to, cycleId: input.cycleId }, viewer);
      title = "Relatório de impacto social (alcance e entregas)";
      break;
    case "financial":
      raw = await loadFinancial({ competence, from: input.from, to: input.to }, viewer);
      title = "Relatório de movimentação financeira";
      break;
    case "administrative":
      raw = await loadAdministrative({ competence, from: input.from, to: input.to }, viewer);
      title = "Relatório administrativo";
      break;
    default:
      throw new Error("VALIDATION");
  }

  const report = envelope(title, raw);
  await createAuditLog({
    entityType: "DirectorReport",
    entityId: input.type,
    action: "GENERATE",
    diff: { type: input.type, format: input.format, generatedAt: report.generatedAt },
    performedByUserId: userId,
  });

  const filename = safeReportFilename(input.type, input.format);
  const mime = REPORT_MIME[input.format];
  if (input.format === "csv") {
    const csv = rowsToCsvSemicolon(["campo", "valor"], csvPairs(report));
    return { format: "csv" as const, filename, mime, body: csv, report };
  }
  if (input.format === "pdf") {
    const body = await buildDirectorPdf(report);
    return { format: "pdf" as const, filename, mime, body, report };
  }
  if (input.format === "xlsx") {
    const body = await buildDirectorXlsx(report);
    return { format: "xlsx" as const, filename, mime, body, report };
  }
  return { format: "json" as const, filename, mime, body: JSON.stringify(report), report };
}

function csvPairs(report: ReturnType<typeof envelope>): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["titulo", report.title],
    ["periodo", report.periodLabel ?? ""],
    ["gerado_em", report.generatedAt ?? ""],
    ["dados_ate", report.dataAsOf ?? ""],
    ["versao_formulas", report.formulaVersion ?? ""],
  ];
  const kpis = report.indicators?.kpis ?? [];
  for (const k of kpis) {
    const rec = k as {
      label: string;
      value: unknown;
      quality?: string;
      currentValue?: number | null;
      percentage?: number | null;
    };
    rows.push([`indicador.${rec.label}`, String(rec.currentValue ?? rec.value ?? "")]);
    rows.push([`indicador.${rec.label}.qualidade`, rec.quality ?? ""]);
    if (rec.percentage != null) rows.push([`indicador.${rec.label}.percentual`, String(rec.percentage)]);
  }
  const quality = Array.isArray(report.quality) ? report.quality : [];
  for (const q of quality) {
    const item = q as { domain?: string; status?: string; note?: string };
    rows.push([`qualidade.${item.domain ?? "geral"}`, `${item.status ?? ""}${item.note ? ` — ${item.note}` : ""}`]);
  }
  return rows;
}
