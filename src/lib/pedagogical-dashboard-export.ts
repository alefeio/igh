import "server-only";

import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { BRAND } from "@/lib/brand";
import type { PedagogicalDashboardPayload } from "@/lib/pedagogical-dashboard";

const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
  color: { argb: "FF1F2937" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 10,
  color: { argb: "FFFFFFFF" },
};
const BODY_FONT: Partial<ExcelJS.Font> = { size: 10, color: { argb: "FF1F2937" } };
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4F78" },
};
const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.font = HEADER_FONT;
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 22;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
  }
}

function styleDataRow(row: ExcelJS.Row, colCount: number, alt: boolean) {
  row.font = BODY_FONT;
  row.alignment = { vertical: "middle", wrapText: false };
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = THIN_BORDER;
    if (alt) cell.fill = ALT_ROW_FILL;
  }
}

function setNum(cell: ExcelJS.Cell, value: number | null | undefined, format?: string) {
  if (value == null || Number.isNaN(value)) {
    cell.value = "—";
    cell.alignment = { horizontal: "center", vertical: "middle" };
    return;
  }
  cell.value = value;
  if (format) cell.numFmt = format;
  cell.alignment = { horizontal: "right", vertical: "middle" };
}

function fitColumnWidths(ws: ExcelJS.Worksheet, padding = 2) {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      const text =
        v == null
          ? ""
          : typeof v === "object" && "text" in v
            ? String((v as { text: string }).text)
            : String(v);
      max = Math.max(max, text.length);
    });
    col.width = Math.min(Math.max(max + padding, 8), 48);
  });
}

function fmtMetric(value: number | string | null, suffix?: string | null): string {
  if (value == null) return "—";
  if (typeof value === "number" && suffix === "%") return `${value}%`;
  if (typeof value === "number") return String(value);
  return suffix ? `${value}${suffix}` : String(value);
}

function fmtPct(n: number | null): string {
  return n == null ? "—" : `${n}%`;
}

function toPdfText(text: string): string {
  const map: Record<string, string> = {
    á: "a",
    à: "a",
    ã: "a",
    â: "a",
    ä: "a",
    é: "e",
    ê: "e",
    ë: "e",
    í: "i",
    ï: "i",
    ó: "o",
    ô: "o",
    õ: "o",
    ö: "o",
    ú: "u",
    ü: "u",
    ç: "c",
    Á: "A",
    À: "A",
    Ã: "A",
    Â: "A",
    É: "E",
    Ê: "E",
    Í: "I",
    Ó: "O",
    Ô: "O",
    Õ: "O",
    Ú: "U",
    Ç: "C",
    "\u2014": "-",
    "\u2013": "-",
  };
  let out = text;
  for (const [from, to] of Object.entries(map)) {
    out = out.split(from).join(to);
  }
  return out.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, " ");
}

function filtersLabel(payload: PedagogicalDashboardPayload): string {
  const f = payload.filtersApplied;
  const parts: string[] = [];
  if (f.cycleIds.length > 0) {
    const labels = payload.cycles
      .filter((c) => f.cycleIds.includes(c.id))
      .map((c) => c.label);
    parts.push(labels.length ? `Ciclos: ${labels.join(", ")}` : `Ciclos: ${f.cycleIds.length}`);
  }
  if (f.year != null) parts.push(`Ano: ${f.year}`);
  if (f.cycleNumber != null) parts.push(`Nº ciclo: ${f.cycleNumber}`);
  if (f.courseId) {
    const name = payload.courses.find((c) => c.id === f.courseId)?.name;
    parts.push(`Curso: ${name ?? f.courseId}`);
  }
  if (f.teacherId) {
    const name = payload.teachers.find((t) => t.id === f.teacherId)?.name;
    parts.push(`Professor: ${name ?? f.teacherId}`);
  }
  if (f.classGroupId) {
    const label = payload.classGroups.find((c) => c.id === f.classGroupId)?.label;
    parts.push(`Turma: ${label ?? f.classGroupId}`);
  }
  if (f.classGroupStatus) parts.push(`Status: ${f.classGroupStatus}`);
  if (f.isExternal === true) parts.push("Tipo: externas");
  if (f.isExternal === false) parts.push("Tipo: internas");
  return parts.length ? parts.join(" | ") : "Sem filtros específicos (todos os ciclos selecionados ou vazios)";
}

/** Excel: Resumo + Turmas + Observações (mesmo modelo do dashboard). */
export async function buildPedagogicalDashboardXlsx(
  payload: PedagogicalDashboardPayload,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = `Cadastro Cursos ${BRAND.shortName}`;
  wb.created = new Date();
  const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Belem" });
  const title = "Dashboard pedagógico";

  // --- Resumo ---
  const wsResumo = wb.addWorksheet("Resumo", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  wsResumo.mergeCells(1, 1, 1, 3);
  const titleCell = wsResumo.getCell(1, 1);
  titleCell.value = `${title} — gerado em ${generatedAt}`;
  titleCell.font = TITLE_FONT;
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  wsResumo.getRow(1).height = 26;

  const headerResumo = wsResumo.getRow(2);
  ["Indicador", "Valor", "Observação"].forEach((h, i) => {
    headerResumo.getCell(i + 1).value = h;
  });
  styleHeaderRow(headerResumo, 3);

  payload.summary.forEach((m, idx) => {
    const row = wsResumo.getRow(idx + 3);
    row.getCell(1).value = m.label;
    row.getCell(2).value = fmtMetric(m.value, m.suffix);
    row.getCell(3).value = m.hint ?? "";
    styleDataRow(row, 3, idx % 2 === 1);
    row.getCell(3).alignment = { vertical: "middle", wrapText: true };
  });

  const statusStart = 3 + payload.summary.length + 1;
  wsResumo.getRow(statusStart).getCell(1).value = "Turmas por status";
  wsResumo.getRow(statusStart).getCell(1).font = { ...BODY_FONT, bold: true };
  payload.byStatus.forEach((s, idx) => {
    const row = wsResumo.getRow(statusStart + 1 + idx);
    row.getCell(1).value = s.label;
    setNum(row.getCell(2), s.count, "0");
    styleDataRow(row, 2, idx % 2 === 1);
  });

  const filterRow = statusStart + 1 + payload.byStatus.length + 1;
  wsResumo.getRow(filterRow).getCell(1).value = "Filtros aplicados";
  wsResumo.getRow(filterRow).getCell(1).font = { ...BODY_FONT, bold: true };
  wsResumo.mergeCells(filterRow + 1, 1, filterRow + 1, 3);
  wsResumo.getRow(filterRow + 1).getCell(1).value = filtersLabel(payload);
  wsResumo.getRow(filterRow + 1).getCell(1).alignment = { wrapText: true, vertical: "middle" };

  fitColumnWidths(wsResumo);
  wsResumo.getColumn(3).width = 55;

  // --- Turmas ---
  const wsTurmas = wb.addWorksheet("Turmas", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  const turmaHeaders = [
    "Curso",
    "Local",
    "Ciclo",
    "Status",
    "Professor(es)",
    "Tipo",
    "Capacidade",
    "Inscritos",
    "Ocupação %",
    "Freq. média %",
    "Formados",
    "Taxa formados %",
    "Chamada (com/passadas)",
  ];

  wsTurmas.mergeCells(1, 1, 1, turmaHeaders.length);
  const turmasTitle = wsTurmas.getCell(1, 1);
  turmasTitle.value = `${title} — Detalhe por turma`;
  turmasTitle.font = TITLE_FONT;
  wsTurmas.getRow(1).height = 26;

  const headerTurmas = wsTurmas.getRow(2);
  turmaHeaders.forEach((h, i) => {
    headerTurmas.getCell(i + 1).value = h;
  });
  styleHeaderRow(headerTurmas, turmaHeaders.length);

  payload.turmaRows.forEach((r, idx) => {
    const row = wsTurmas.getRow(idx + 3);
    row.getCell(1).value = r.courseName;
    row.getCell(2).value = r.location;
    row.getCell(3).value = r.cycleLabel;
    row.getCell(4).value = r.statusLabel;
    row.getCell(5).value = r.teachers;
    row.getCell(6).value = r.isExternal ? "Externa" : "Interna";
    setNum(row.getCell(7), r.capacity, "0");
    setNum(row.getCell(8), r.inscritos, "0");
    setNum(row.getCell(9), r.ocupacaoPercent, "0.0");
    setNum(row.getCell(10), r.frequenciaMediaPercent, "0.0");
    setNum(row.getCell(11), r.status === "ENCERRADA" ? r.formados : null, "0");
    setNum(row.getCell(12), r.taxaFormadosPercent, "0.0");
    row.getCell(13).value =
      r.sessoesPassadas === 0 ? "—" : `${r.sessoesComChamada}/${r.sessoesPassadas}`;
    row.getCell(13).alignment = { horizontal: "center", vertical: "middle" };
    styleDataRow(row, turmaHeaders.length, idx % 2 === 1);
  });

  if (payload.turmaRows.length > 0) {
    wsTurmas.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2 + payload.turmaRows.length, column: turmaHeaders.length },
    };
  }
  fitColumnWidths(wsTurmas);

  // --- Observações ---
  const wsNotes = wb.addWorksheet("Observações", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  wsNotes.getCell(1, 1).value = "Observações (dados insuficientes ou regras de cálculo)";
  wsNotes.getCell(1, 1).font = TITLE_FONT;
  if (payload.notes.length === 0) {
    wsNotes.getCell(2, 1).value = "Nenhuma observação para este filtro.";
  } else {
    payload.notes.forEach((n, idx) => {
      wsNotes.getCell(idx + 2, 1).value = n;
      wsNotes.getCell(idx + 2, 1).alignment = { wrapText: true, vertical: "top" };
    });
  }
  wsNotes.getColumn(1).width = 100;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** PDF paisagem: mesmos indicadores e tabela de turmas do Excel/dashboard. */
export async function buildPedagogicalDashboardPdf(
  payload: PedagogicalDashboardPayload,
): Promise<Buffer> {
  const PAGE_WIDTH = 842;
  const PAGE_HEIGHT = 595;
  const MARGIN = 28;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
  const ROW_H = 12;
  const FONT_TITLE = 13;
  const FONT_BODY = 7.5;
  const FONT_SMALL = 6.5;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.12, 0.12, 0.12);
  const gray = rgb(0.4, 0.4, 0.4);
  const headerBg = rgb(0.12, 0.31, 0.47);
  const altRow = rgb(0.95, 0.95, 0.95);
  const white = rgb(1, 1, 1);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function drawText(
    text: string,
    opts: {
      x: number;
      y: number;
      size?: number;
      font?: typeof font | typeof fontBold;
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
    },
  ) {
    const f = opts.font ?? font;
    const size = opts.size ?? FONT_BODY;
    let t = toPdfText(text);
    if (opts.maxWidth != null) {
      while (t.length > 1 && f.widthOfTextAtSize(t, size) > opts.maxWidth) {
        t = t.slice(0, -1);
      }
      if (t !== toPdfText(text) && t.length > 1) t = `${t.slice(0, -1)}.`;
    }
    page.drawText(t, {
      x: opts.x,
      y: opts.y,
      size,
      font: f,
      color: opts.color ?? black,
    });
  }

  function newPageIfNeeded(needed: number) {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  type Col = { label: string; width: number; align?: "left" | "right" | "center" };

  function drawTableHeader(cols: Col[]) {
    newPageIfNeeded(ROW_H + 4);
    page.drawRectangle({
      x: MARGIN,
      y: y - 2,
      width: CONTENT_WIDTH,
      height: ROW_H + 2,
      color: headerBg,
    });
    let x = MARGIN + 3;
    for (const col of cols) {
      drawText(col.label, {
        x,
        y: y + 1,
        size: FONT_SMALL,
        font: fontBold,
        color: white,
        maxWidth: col.width - 4,
      });
      x += col.width;
    }
    y -= ROW_H + 4;
  }

  function drawTableRow(cols: Col[], values: string[], alt: boolean) {
    newPageIfNeeded(ROW_H + 2);
    if (alt) {
      page.drawRectangle({
        x: MARGIN,
        y: y - 2,
        width: CONTENT_WIDTH,
        height: ROW_H + 1,
        color: altRow,
      });
    }
    let x = MARGIN + 3;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]!;
      const val = values[i] ?? "";
      const textW = font.widthOfTextAtSize(toPdfText(val).slice(0, 80), FONT_BODY);
      let drawX = x;
      if (col.align === "right") {
        drawX = x + Math.max(0, col.width - 6 - Math.min(textW, col.width - 6));
      } else if (col.align === "center") {
        drawX = x + Math.max(0, (col.width - Math.min(textW, col.width - 4)) / 2);
      }
      drawText(val, { x: drawX, y, size: FONT_BODY, maxWidth: col.width - 4 });
      x += col.width;
    }
    y -= ROW_H + 1;
  }

  const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Belem" });
  drawText("Dashboard pedagogico", {
    x: MARGIN,
    y,
    size: FONT_TITLE,
    font: fontBold,
  });
  y -= 16;
  drawText(`Gerado em ${generatedAt}`, { x: MARGIN, y, size: FONT_SMALL, color: gray });
  y -= 12;
  drawText(filtersLabel(payload), {
    x: MARGIN,
    y,
    size: FONT_SMALL,
    color: gray,
    maxWidth: CONTENT_WIDTH,
  });
  y -= 18;

  drawText("Resumo", { x: MARGIN, y, size: 10, font: fontBold });
  y -= 14;

  const summaryCols: Col[] = [
    { label: "Indicador", width: 220 },
    { label: "Valor", width: 80, align: "right" },
    { label: "Observacao", width: CONTENT_WIDTH - 300 },
  ];
  drawTableHeader(summaryCols);
  for (let i = 0; i < payload.summary.length; i++) {
    const m = payload.summary[i]!;
    drawTableRow(
      summaryCols,
      [m.label, fmtMetric(m.value, m.suffix), m.hint ?? ""],
      i % 2 === 1,
    );
  }

  if (payload.byStatus.length > 0) {
    y -= 10;
    newPageIfNeeded(40);
    drawText("Turmas por status", { x: MARGIN, y, size: 10, font: fontBold });
    y -= 14;
    const statusCols: Col[] = [
      { label: "Status", width: 200 },
      { label: "Qtd", width: 60, align: "right" },
    ];
    drawTableHeader(statusCols);
    payload.byStatus.forEach((s, i) => {
      drawTableRow(statusCols, [s.label, String(s.count)], i % 2 === 1);
    });
  }

  y -= 12;
  newPageIfNeeded(60);
  drawText("Detalhe por turma", { x: MARGIN, y, size: 10, font: fontBold });
  y -= 14;

  const turmaCols: Col[] = [
    { label: "Curso", width: 140 },
    { label: "Ciclo", width: 50, align: "center" },
    { label: "Status", width: 70 },
    { label: "Professor(es)", width: 110 },
    { label: "Insc.", width: 45, align: "right" },
    { label: "Ocup.%", width: 45, align: "right" },
    { label: "Freq.%", width: 45, align: "right" },
    { label: "Form.", width: 40, align: "right" },
    { label: "Chamada", width: 55, align: "center" },
    { label: "Local", width: CONTENT_WIDTH - 600 },
  ];
  drawTableHeader(turmaCols);

  if (payload.turmaRows.length === 0) {
    drawText("Sem turmas neste filtro.", { x: MARGIN, y, size: FONT_BODY, color: gray });
    y -= 14;
  } else {
    payload.turmaRows.forEach((r, i) => {
      drawTableRow(
        turmaCols,
        [
          r.courseName,
          r.cycleLabel,
          r.statusLabel,
          r.teachers,
          `${r.inscritos}/${r.capacity}`,
          fmtPct(r.ocupacaoPercent),
          fmtPct(r.frequenciaMediaPercent),
          r.status === "ENCERRADA" ? String(r.formados) : "—",
          r.sessoesPassadas === 0 ? "—" : `${r.sessoesComChamada}/${r.sessoesPassadas}`,
          r.location,
        ],
        i % 2 === 1,
      );
    });
  }

  if (payload.notes.length > 0) {
    y -= 12;
    newPageIfNeeded(40);
    drawText("Observacoes", { x: MARGIN, y, size: 10, font: fontBold });
    y -= 14;
    for (const note of payload.notes) {
      newPageIfNeeded(ROW_H + 4);
      drawText(`- ${note}`, {
        x: MARGIN,
        y,
        size: FONT_SMALL,
        color: gray,
        maxWidth: CONTENT_WIDTH,
      });
      y -= ROW_H + 2;
    }
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
