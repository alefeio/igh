import ExcelJS from "exceljs";

import { neutralizeCsvFormula } from "@/lib/csv-export";
import { BRAND } from "@/lib/brand";
import {
  domainLabel,
  excelNaiveDateFromBrazilIso,
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
  currentValue?: number | null;
  targetValue?: number | null;
  percentage?: number | null;
  formattedValue?: string;
};

type Alert = { title?: string; fact?: string; domain?: string; severity?: string; suggestedDecision?: string };
type QualityItem = { domain?: string; status?: string; note?: string };

function asText(value: unknown): string {
  if (value == null) return "";
  return neutralizeCsvFormula(String(value));
}

function optionalText(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = neutralizeCsvFormula(String(value).trim());
  return s.length > 0 ? s : undefined;
}

function setIfText(cell: ExcelJS.Cell, value: unknown) {
  const t = optionalText(value);
  if (t !== undefined) cell.value = t;
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

function writeHeaderFill(ws: ExcelJS.Worksheet, row: number, cols: number, navy: string) {
  for (let c = 1; c <= cols; c++) {
    const cell = ws.getCell(row, c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
  }
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
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      printArea: "A1:C40",
    },
  });
  resumo.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  resumo.getColumn(1).width = 36;
  resumo.getColumn(2).width = 48;
  resumo.getColumn(3).width = 28;
  resumo.mergeCells("A1:C1");
  resumo.getCell("A1").value = `${BRAND.shortName} — ${BRAND.legalName}`;
  resumo.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
  resumo.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
  resumo.getCell("A2").value = "Relatório";
  resumo.getCell("B2").value = report.title;
  resumo.getCell("A3").value = "Filtros";
  resumo.getCell("B3").value = report.periodLabel || formatFiltersHuman(report.period);
  resumo.getCell("A4").value = "Dados considerados até";
  resumo.getCell("B4").value =
    typeof report.dataAsOf === "string" ? formatInstantPtBr(report.dataAsOf) : asText(report.dataAsOf);
  resumo.getCell("A5").value = "Gerado em";
  if (typeof report.generatedAt === "string") {
    const naive = excelNaiveDateFromBrazilIso(report.generatedAt);
    if (naive) {
      resumo.getCell("B5").value = naive;
      resumo.getCell("B5").numFmt = "dd/mm/yyyy hh:mm";
    } else {
      setIfText(resumo.getCell("B5"), report.generatedAt);
    }
  }
  resumo.getCell("A6").value = "Síntese";
  resumo.getCell("B6").value = "Indicadores da área da Direção, sem dados pessoais nominais.";
  resumo.getCell("A8").value = "Indicador";
  resumo.getCell("B8").value = "Valor";
  resumo.getCell("C8").value = "Qualidade";
  writeHeaderFill(resumo, 8, 3, navy);
  let r = 9;
  for (const k of kpis.slice(0, 8)) {
    const money = parseMoneyReais(typeof k.value === "string" ? k.value : null, k.metricId);
    resumo.getCell(r, 1).value = k.label;
    const cell = resumo.getCell(r, 2);
    if (money != null) {
      cell.value = money;
      cell.numFmt = '"R$" #,##0.00';
    } else if (typeof k.value === "number" && k.metricId?.startsWith("fin.")) {
      cell.value = k.value / 100;
      cell.numFmt = '"R$" #,##0.00';
    } else if (k.percentage != null && Number.isFinite(k.percentage)) {
      cell.value = k.percentage / 100;
      cell.numFmt = "0.0%";
    } else if (k.currentValue != null && Number.isFinite(k.currentValue) && k.unit !== "%") {
      cell.value = k.currentValue;
      cell.numFmt = "#,##0";
    } else if (typeof k.value === "number" && Number.isFinite(k.value)) {
      cell.value = k.unit === "%" ? k.value / 100 : k.value;
      cell.numFmt = k.unit === "%" ? "0.0%" : "#,##0";
    } else {
      const shown = optionalText(k.formattedValue ?? k.value);
      if (shown !== undefined) cell.value = shown;
    }
    resumo.getCell(r, 3).value = qualityStatusLabel(k.quality ?? "ok");
    r += 1;
  }
  const lastKpi = r - 1;
  r += 1;
  resumo.getCell(r, 1).value = "Principais alertas";
  resumo.getCell(r, 1).font = { bold: true };
  r += 1;
  for (const a of (report.alerts ?? []).slice(0, 6)) {
    resumo.getCell(r, 1).value = a.title ?? undefined;
    setIfText(resumo.getCell(r, 2), a.fact);
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
  resumo.autoFilter = { from: { row: 8, column: 1 }, to: { row: Math.max(8, lastKpi), column: 3 } };
  resumo.pageSetup.printArea = `A1:C${r}`;

  const ind = wb.addWorksheet("Indicadores", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  ind.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  ind.addRow(["Indicador", "Realizado", "Meta", "Percentual", "Qualidade", "Como é calculado", "Apresentação"]);
  writeHeaderFill(ind, 1, 7, navy);
  ind.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };
  for (const k of kpis) {
    const money = parseMoneyReais(typeof k.value === "string" ? k.value : null, k.metricId);
    const row = ind.addRow([k.label]);
    if (money != null) {
      row.getCell(2).value = money;
      row.getCell(2).numFmt = '"R$" #,##0.00';
    } else if (typeof k.value === "number" && k.metricId?.startsWith("fin.")) {
      row.getCell(2).value = k.value / 100;
      row.getCell(2).numFmt = '"R$" #,##0.00';
    } else if (k.currentValue != null && Number.isFinite(k.currentValue)) {
      row.getCell(2).value = k.unit === "%" ? k.currentValue / 100 : k.currentValue;
      row.getCell(2).numFmt = k.unit === "%" ? "0.0%" : "#,##0";
    } else if (typeof k.value === "number" && Number.isFinite(k.value)) {
      row.getCell(2).value = k.unit === "%" ? k.value / 100 : k.value;
      row.getCell(2).numFmt = k.unit === "%" ? "0.0%" : "#,##0";
    } else {
      setIfText(row.getCell(2), k.value);
    }
    if (k.targetValue != null && Number.isFinite(k.targetValue)) {
      row.getCell(3).value = k.targetValue;
      row.getCell(3).numFmt = "#,##0";
    }
    if (k.percentage != null && Number.isFinite(k.percentage)) {
      row.getCell(4).value = k.percentage / 100;
      row.getCell(4).numFmt = "0.0%";
    }
    setIfText(row.getCell(5), qualityStatusLabel(k.quality ?? "ok"));
    setIfText(row.getCell(6), k.explanation || k.formula);
    const presentation = optionalText(k.formattedValue);
    if (presentation !== undefined) row.getCell(7).value = presentation;
  }
  ind.columns.forEach((c) => {
    c.width = 22;
    c.alignment = { wrapText: true, vertical: "top" };
  });
  ind.pageSetup.printArea = `A1:G${Math.max(1, kpis.length + 1)}`;

  const alerts = wb.addWorksheet("Alertas", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  alerts.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  alerts.addRow(["Alerta", "Tema", "Severidade", "Fato", "Decisão sugerida"]);
  writeHeaderFill(alerts, 1, 5, navy);
  alerts.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 } };
  const sevFill: Record<string, string> = {
    critical: "FECACA",
    attention: "FDE68A",
    info: "DBEAFE",
  };
  for (const a of report.alerts ?? []) {
    const row = alerts.addRow([]);
    setIfText(row.getCell(1), a.title);
    setIfText(row.getCell(2), domainLabel(a.domain ?? ""));
    setIfText(row.getCell(3), severityLabel(a.severity ?? ""));
    setIfText(row.getCell(4), a.fact);
    setIfText(row.getCell(5), a.suggestedDecision);
    const fill = sevFill[a.severity ?? ""] ?? "FFFFFF";
    row.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  }
  alerts.columns.forEach((c) => {
    c.width = 28;
    c.alignment = { wrapText: true };
  });
  alerts.pageSetup.printArea = `A1:E${Math.max(1, (report.alerts?.length ?? 0) + 1)}`;

  const qual = wb.addWorksheet("Qualidade", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  qual.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  qual.addRow(["Domínio", "Situação", "Observação", "Impacto na leitura"]);
  writeHeaderFill(qual, 1, 4, navy);
  qual.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 4 } };
  for (const q of quality) {
    const status = qualityStatusLabel(q.status ?? "ok");
    const impact =
      q.status === "unavailable"
        ? "Não use este tema como base exclusiva de decisão."
        : q.status === "partial"
          ? "Leia com ressalva: há lacunas no cálculo."
          : "Leitura completa neste tema.";
    const row = qual.addRow([]);
    setIfText(row.getCell(1), domainLabel(q.domain ?? ""));
    setIfText(row.getCell(2), status);
    setIfText(row.getCell(3), q.note);
    setIfText(row.getCell(4), impact);
  }
  for (const c of report.caveats ?? []) {
    const row = qual.addRow([]);
    setIfText(row.getCell(1), "Geral");
    setIfText(row.getCell(2), "Informativo");
    setIfText(row.getCell(3), c);
    setIfText(row.getCell(4), "Ressalva complementar.");
  }
  qual.columns.forEach((c) => {
    c.width = 28;
    c.alignment = { wrapText: true };
  });
  const qualLast = Math.max(1, 1 + quality.length + (report.caveats?.length ?? 0));
  qual.pageSetup.printArea = `A1:D${qualLast}`;

  const def = wb.addWorksheet("Definições", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  def.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  def.addRow(["Identificador", "Indicador", "Valor"]);
  writeHeaderFill(def, 1, 3, navy);
  def.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 3 } };
  for (const k of kpis) {
    const row = def.addRow([]);
    setIfText(row.getCell(1), k.metricId);
    setIfText(row.getCell(2), k.label);
    setIfText(row.getCell(3), k.formula);
  }
  const ver = def.addRow([]);
  ver.getCell(1).value = "metadata.formula_version";
  ver.getCell(2).value = "Versão da metodologia";
  setIfText(ver.getCell(3), report.formulaVersion);
  def.columns.forEach((c) => {
    c.width = 40;
    c.alignment = { wrapText: true };
  });
  def.pageSetup.printArea = `A1:C${Math.max(1, kpis.length + 2)}`;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
