import ExcelJS from "exceljs";

import { neutralizeCsvFormula } from "@/lib/csv-export";
import { BRAND } from "@/lib/brand";

function asData(value: unknown): ExcelJS.CellValue {
  if (value == null) return "";
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  const s = String(value);
  return neutralizeCsvFormula(s);
}

function addSheet(wb: ExcelJS.Workbook, name: string, headers: string[], rows: unknown[][]) {
  const ws = wb.addWorksheet(name);
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
  for (const row of rows) {
    ws.addRow(row.map(asData));
  }
  ws.columns.forEach((c) => {
    c.width = 28;
  });
}

export async function buildDirectorXlsx(report: {
  title: string;
  period?: unknown;
  generatedAt?: unknown;
  dataAsOf?: unknown;
  formulaVersion?: unknown;
  indicators?: { kpis?: Array<{ metricId?: string; label: string; value: unknown; formula?: string; quality?: string }> };
  alerts?: Array<{ title?: string; fact?: string; domain?: string; severity?: string }>;
  quality?: unknown;
  caveats?: string[];
  disclaimer?: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND.shortName;
  const kpis = report.indicators?.kpis ?? [];
  addSheet(wb, "Resumo", ["campo", "valor"], [
    ["instituição", BRAND.legalName],
    ["título", report.title],
    ["gerado", report.generatedAt],
    ["dataAsOf", report.dataAsOf],
    ["fórmulas", report.formulaVersion],
    ["filtros", JSON.stringify(report.period ?? {})],
    ["disclaimer", report.disclaimer],
  ]);
  addSheet(
    wb,
    "Indicadores",
    ["metricId", "rótulo", "valor", "fórmula", "qualidade"],
    kpis.map((k) => [k.metricId, k.label, k.value, k.formula, k.quality]),
  );
  addSheet(
    wb,
    "Séries",
    ["alerta", "domínio", "severidade", "fato"],
    (report.alerts ?? []).map((a) => [a.title, a.domain, a.severity, a.fact]),
  );
  addSheet(wb, "Qualidade", ["item"], [
    [JSON.stringify(report.quality ?? {})],
    ...((report.caveats ?? []).map((c) => [c]) as string[][]),
  ]);
  addSheet(wb, "Definições", ["nota"], [
    ["Catálogo do Diretor é a fonte das fórmulas."],
    ["Sem PII. Geração sob demanda, sem snapshot."],
    ["Idade em aberto ≠ vencimento (não há dueDate)."],
    ["Movimentação paga ≠ saldo bancário."],
  ]);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
