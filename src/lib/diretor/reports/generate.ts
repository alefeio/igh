import "server-only";

import { createAuditLog } from "@/lib/audit";
import { rowsToCsvSemicolon } from "@/lib/csv-export";
import { loadAcademic } from "@/lib/diretor/metrics/academic";
import { loadAdministrative } from "@/lib/diretor/metrics/administrative";
import { loadFinancial } from "@/lib/diretor/metrics/financial";
import { loadOffer } from "@/lib/diretor/metrics/offer";
import { loadOverviewSummaries } from "@/lib/diretor/metrics/overview";
import { loadSocialImpact } from "@/lib/diretor/metrics/social";
import { resolveDirectorScope } from "@/lib/diretor/load-scope";
import type { reportsGenerateSchema } from "@/lib/diretor/search-params";
import type { z } from "zod";

export const REPORT_CATALOG = [
  { type: "executive", title: "Executivo do período", domain: "overview" },
  { type: "academic", title: "Acadêmico do ciclo", domain: "academic" },
  { type: "offer", title: "Oferta e Territórios", domain: "offer" },
  { type: "social", title: "Impacto Social", domain: "social" },
  { type: "financial", title: "Movimentação Financeira", domain: "financial" },
  { type: "administrative", title: "Administrativo", domain: "administrative" },
] as const;

export type ReportType = (typeof REPORT_CATALOG)[number]["type"];

function envelope(title: string, payload: unknown) {
  const p = payload as { meta?: Record<string, unknown>; qualityNotes?: string[]; alerts?: unknown[] };
  return {
    title,
    institution: "IGH",
    period: p.meta?.filters ?? {},
    generatedAt: p.meta?.generatedAt,
    dataAsOf: p.meta?.dataAsOf,
    formulaVersion: p.meta?.formulaVersion,
    indicators: payload,
    alerts: p.alerts ?? [],
    quality: p.meta?.quality ?? [],
    caveats: p.qualityNotes ?? [],
    pagination: { page: 1, pageSize: 1, total: 1 },
    disclaimer: "Geração sob demanda. Nenhum snapshot persistido nesta fase. Sem dados pessoais nominais.",
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

  let raw: unknown;
  let title = "";
  switch (input.type) {
    case "executive":
      raw = await loadOverviewSummaries({ scope, viewer, execCompetence: input.competence });
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
      raw = await loadFinancial({ competence: input.competence, from: input.from, to: input.to }, viewer);
      title = "Relatório de movimentação financeira";
      break;
    case "administrative":
      raw = await loadAdministrative({ competence: input.competence, from: input.from, to: input.to }, viewer);
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

  if (input.format === "csv") {
    const csv = rowsToCsvSemicolon(
      ["campo", "valor"],
      flattenPairs(report).map(([k, v]) => [k, v]),
    );
    return { format: "csv" as const, filename: `diretor-${input.type}.csv`, body: csv, report };
  }
  return { format: "json" as const, filename: `diretor-${input.type}.json`, body: JSON.stringify(report), report };
}

function flattenPairs(obj: unknown, prefix = ""): Array<[string, string]> {
  if (obj == null) return [[prefix || "valor", ""]];
  if (typeof obj !== "object") return [[prefix, String(obj)]];
  if (Array.isArray(obj)) {
    return obj.flatMap((item, i) => flattenPairs(item, `${prefix}[${i}]`));
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flattenPairs(v, prefix ? `${prefix}.${k}` : k),
  );
}
