import ExcelJS from "exceljs";

import { neutralizeCsvFormula } from "@/lib/csv-export";
import { BRAND } from "@/lib/brand";
import {
  domainLabel,
  formatFiltersHuman,
  formatInstantPtBr,
  qualityStatusLabel,
  severityLabel,
} from "@/lib/diretor/ui-labels";

type Kpi = {
  metricId?: string;
  label: string;
  value: unknown;
  formula?: string;
  quality?: string;
  unit?: string;
  explanation?: string;
};

type Alert = { title?: string; fact?: string; domain?: string; severity?: string; suggestedDecision?: string };
type QualityItem = { domain?: string; status?: string; note?: string };

function asText(value: unknown): string {
  if (value == null) return "";
  return neutralizeCsvFormula(String(value));
}

function parsePercent(value: unknown, unit?: string): number | null {
  if (unit === "%" && typeof value === "number") return value / 100;
  if (typeof value === "string" && value.includes("%")) {
    const n = Number(value.replace("%", "").replace(",", ".").trim());
    return Number.isFinite(n) ? n / 100 : null;
  }
  return null;
}

function parseMoneyReais(value: unknown, metricId?: string): number | null {
  if (typeof value === "string" && /R\$/.test(value)) {
    const neg = value.includes("-") || /\(.*\)/.test(value);
    const n = Number(value.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return neg && n > 0 ? -n : n;
  }
  if (typeof value === "number" && metricId?.startsWith("fin.")) {
    return value / 100;
  }
  return null;
}

function parseCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export async function buildDirectorXlsx(report: {
  title: string;
  period?: unknown;
  periodLabel?: string;
  generatedAt?: unknown;
  dataAsOf?: unknown;
  formulaVersion?: unknown;
  indicators?: { kpis?: Kpi[] };
  alerts?: Alert[];
  quality?: QualityItem[] | unknown;
  caveats?: string[];
  disclaimer?: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND.shortName;
  wb.company = BRAND.legalName;
  const navy = "0D335C";
  const kpis = report.indicators?.kpis ?? [];
  const quality = Array.isArray(report.quality) ? report.quality : [];

  const resumo = wb.addWorksheet("Resumo", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  resumo.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  resumo.getColumn(1).width = 36;
  resumo.getColumn(2).width = 48;
  resumo.getColumn(3).width = 28;
  resumo.mergeCells("A1:C1");
  resumo.getCell("A1").value = `${BRAND.shortName} — ${BRAND.legalName}`;
  resumo.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
  resumo.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
  resumo.getRow(2).values = ["Relatório", report.title];
  resumo.getRow(3).values = ["Filtros", report.periodLabel || formatFiltersHuman(report.period)];
  resumo.getRow(4).values = [
    "Dados considerados até",
    typeof report.dataAsOf === "string" ? formatInstantPtBr(report.dataAsOf) : asText(report.dataAsOf),
  ];
  resumo.getRow(5).values = ["Gerado em", asText(report.generatedAt)];
  resumo.getRow(6).values = ["Síntese", "Indicadores da área da Direção, sem dados pessoais nominais."];
  resumo.getRow(8).values = ["Indicador", "Valor", "Qualidade"];
  resumo.getRow(8).font = { bold: true, color: { argb: "FFFFFFFF" } };
  resumo.getRow(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
  let r = 9;
  for (const k of kpis.slice(0, 8)) {
    const money = parseMoneyReais(k.value, k.metricId);
    const pct = parsePercent(k.value, k.unit);
    const count = money == null && pct == null ? parseCount(k.value) : null;
    resumo.getCell(r, 1).value = k.label;
    const cell = resumo.getCell(r, 2);
    if (money != null) {
      cell.value = money;
      cell.numFmt = '"R$" #,##0.00';
    } else if (pct != null) {
      cell.value = pct;
      cell.numFmt = "0.0%";
    } else if (count != null) {
      cell.value = count;
      cell.numFmt = "#,##0";
    } else {
      cell.value = asText(k.value);
    }
    resumo.getCell(r, 3).value = qualityStatusLabel(k.quality ?? "ok");
    r += 1;
  }
  r += 1;
  resumo.getCell(r, 1).value = "Principais alertas";
  resumo.getCell(r, 1).font = { bold: true };
  r += 1;
  for (const a of (report.alerts ?? []).slice(0, 6)) {
    resumo.getCell(r, 1).value = a.title ?? "";
    resumo.getCell(r, 2).value = asText(a.fact);
    r += 1;
  }
  r += 1;
  resumo.getCell(r, 1).value = "Qualidade";
  resumo.getCell(r, 1).font = { bold: true };
  r += 1;
  for (const q of quality) {
    resumo.getCell(r, 1).value = domainLabel(q.domain ?? "");
    resumo.getCell(r, 2).value = `${qualityStatusLabel(q.status ?? "ok")}${q.note ? ` — ${q.note}` : ""}`;
    r += 1;
  }
  r += 1;
  resumo.getCell(r, 1).value = "Ressalvas";
  resumo.getCell(r, 2).value = asText(report.disclaimer);
  resumo.getCell(r, 1).alignment = { wrapText: true };
  resumo.getCell(r, 2).alignment = { wrapText: true };

  const ind = wb.addWorksheet("Indicadores");
  ind.views = [{ state: "frozen", ySplit: 1 }];
  ind.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };
  ind.addRow(["Indicador", "Valor", "Qualidade", "Como é calculado"]);
  ind.getRow(1).font = { bold: true };
  for (const k of kpis) {
    const money = parseMoneyReais(k.value, k.metricId);
    const pct = parsePercent(k.value, k.unit);
    const count = money == null && pct == null ? parseCount(k.value) : null;
    const row = ind.addRow([k.label, null, qualityStatusLabel(k.quality ?? "ok"), asText(k.explanation || k.formula)]);
    if (money != null) {
      row.getCell(2).value = money;
      row.getCell(2).numFmt = '"R$" #,##0.00';
    } else if (pct != null) {
      row.getCell(2).value = pct;
      row.getCell(2).numFmt = "0.0%";
    } else if (count != null) {
      row.getCell(2).value = count;
    } else {
      row.getCell(2).value = asText(k.value);
    }
  }
  ind.columns.forEach((c) => {
    c.width = 36;
    c.alignment = { wrapText: true, vertical: "top" };
  });

  const alerts = wb.addWorksheet("Alertas");
  alerts.views = [{ state: "frozen", ySplit: 1 }];
  alerts.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };
  alerts.addRow(["Alerta", "Tema", "Severidade", "Fato"]);
  alerts.getRow(1).font = { bold: true };
  for (const a of report.alerts ?? []) {
    alerts.addRow([asText(a.title), domainLabel(a.domain ?? ""), severityLabel(a.severity ?? ""), asText(a.fact)]);
  }
  alerts.columns.forEach((c) => {
    c.width = 32;
    c.alignment = { wrapText: true };
  });

  const qual = wb.addWorksheet("Qualidade");
  qual.views = [{ state: "frozen", ySplit: 1 }];
  qual.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };
  qual.addRow(["Domínio", "Situação", "Observação", "Impacto na leitura"]);
  qual.getRow(1).font = { bold: true };
  for (const q of quality) {
    const status = qualityStatusLabel(q.status ?? "ok");
    const impact =
      q.status === "unavailable"
        ? "Não use este tema como base exclusiva de decisão."
        : q.status === "partial"
          ? "Leia com ressalva: há lacunas no cálculo."
          : "Leitura completa neste tema.";
    qual.addRow([domainLabel(q.domain ?? ""), status, asText(q.note), impact]);
  }
  for (const c of report.caveats ?? []) {
    qual.addRow(["Geral", "Informativo", asText(c), "Ressalva complementar."]);
  }
  qual.columns.forEach((c) => {
    c.width = 28;
    c.alignment = { wrapText: true };
  });

  const def = wb.addWorksheet("Definições");
  def.views = [{ state: "frozen", ySplit: 1 }];
  def.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 3 } };
  def.addRow(["Identificador técnico", "Indicador", "Fórmula"]);
  def.getRow(1).font = { bold: true };
  for (const k of kpis) {
    def.addRow([asText(k.metricId), k.label, asText(k.formula)]);
  }
  def.addRow(["", "Versão das fórmulas", asText(report.formulaVersion)]);
  def.columns.forEach((c) => {
    c.width = 40;
    c.alignment = { wrapText: true };
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
