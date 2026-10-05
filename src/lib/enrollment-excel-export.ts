import ExcelJS from "exceljs";

import { drawGroupedBarChartPng, drawKpiStripPng } from "@/lib/enrollment-chart-canvas";
import type { EnrollmentVacancyRow } from "@/lib/enrollment-vacancy-report";
import {
  groupVacancyRowsByLocation,
  summarizeVacanciesByCourse,
  summarizeVacanciesByLocation,
  summarizeVacanciesByTeacher,
} from "@/lib/enrollment-vacancy-report";

const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
  color: { argb: "FF1F4E79" },
  name: "Calibri",
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 11,
  color: { argb: "FFFFFFFF" },
  name: "Calibri",
};
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4E79" },
};
const BODY_FONT: Partial<ExcelJS.Font> = { name: "Calibri", size: 11 };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFB0B0B0" } },
  left: { style: "thin", color: { argb: "FFB0B0B0" } },
  bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
  right: { style: "thin", color: { argb: "FFB0B0B0" } },
};
const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};

function fitColumns(ws: ExcelJS.Worksheet, min = 10, max = 42) {
  ws.columns.forEach((col) => {
    let longest = min;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > longest) longest = len;
    });
    col.width = Math.min(max, Math.max(min, longest + 2));
  });
}

function styleHeader(row: ExcelJS.Row, colCount: number) {
  row.height = 22;
  row.font = HEADER_FONT;
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
  }
}

function styleBody(row: ExcelJS.Row, colCount: number, alt: boolean) {
  row.font = BODY_FONT;
  row.alignment = { vertical: "middle" };
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = THIN_BORDER;
    if (alt) cell.fill = ALT_ROW_FILL;
  }
}

/** Tabela Excel nativa (filtros + faixas) a partir da linha informada. */
function addExcelTable(
  ws: ExcelJS.Worksheet,
  name: string,
  headers: string[],
  rows: Array<Array<string | number | null>>,
  startRow = 2,
) {
  if (rows.length === 0) {
    const headerRow = ws.getRow(startRow);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    styleHeader(headerRow, headers.length);
    ws.autoFilter = {
      from: { row: startRow, column: 1 },
      to: { row: startRow, column: headers.length },
    };
    fitColumns(ws);
    return;
  }

  ws.addTable({
    name,
    ref: `A${startRow}`,
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
    },
    columns: headers.map((h) => ({ name: h, filterButton: true })),
    rows,
  });

  styleHeader(ws.getRow(startRow), headers.length);
  rows.forEach((values, idx) => {
    const row = ws.getRow(startRow + 1 + idx);
    values.forEach((value, col) => {
      const cell = row.getCell(col + 1);
      if (typeof value === "number") {
        cell.alignment = { horizontal: "right", vertical: "middle" };
      }
    });
    styleBody(row, headers.length, idx % 2 === 1);
  });
  fitColumns(ws);
}

export type EnrollmentExcelEnrollmentRow = Record<string, string | number>;

export async function buildEnrollmentExcelBlob(params: {
  vacancyRows: EnrollmentVacancyRow[];
  enrollmentRows?: EnrollmentExcelEnrollmentRow[];
  generatedAt?: Date;
}): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "IGH Cadastro de Cursos";
  wb.created = params.generatedAt ?? new Date();

  const vacancyRows = params.vacancyRows;
  const byCourse = summarizeVacanciesByCourse(vacancyRows);
  const byTeacher = summarizeVacanciesByTeacher(vacancyRows);
  const byLocation = summarizeVacanciesByLocation(vacancyRows);
  const locationSections = groupVacancyRowsByLocation(vacancyRows);

  const enrolledTotal = vacancyRows.reduce((s, r) => s + r.enrolled, 0);
  const graduatedTotal = vacancyRows.reduce((s, r) => s + r.graduated, 0);
  const capacityTotal = vacancyRows.reduce((s, r) => s + r.capacity, 0);
  const occupancy = capacityTotal > 0 ? Math.round((enrolledTotal / capacityTotal) * 100) : null;

  const wsResumo = wb.addWorksheet("Resumo", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  wsResumo.getCell(1, 1).value = "Resumo de vagas, matrículas e formados";
  wsResumo.getCell(1, 1).font = TITLE_FONT;
  wsResumo.mergeCells(1, 1, 1, 4);
  wsResumo.getRow(1).height = 26;

  ["Matriculados", "Formados", "Capacidade", "Ocupação %"].forEach((label, i) => {
    const cell = wsResumo.getCell(3, i + 1);
    cell.value = label;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: "center" };
  });
  [enrolledTotal, graduatedTotal, capacityTotal, occupancy ?? "—"].forEach((value, i) => {
    const cell = wsResumo.getCell(4, i + 1);
    cell.value = value;
    cell.font = { ...BODY_FONT, bold: true, size: 16 };
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: "center" };
  });

  wsResumo.getCell(6, 1).value = "Resumo por curso";
  wsResumo.getCell(6, 1).font = { ...BODY_FONT, bold: true, size: 12 };
  addExcelTable(
    wsResumo,
    "TabelaResumoCurso",
    ["Curso", "Turmas", "Capacidade", "Matriculados", "Formados", "Ocupação %"],
    byCourse.map((row) => [
      row.courseName,
      row.classes,
      row.capacity,
      row.enrolled,
      row.graduated,
      row.capacity > 0 ? Math.round((row.enrolled / row.capacity) * 100) : null,
    ]),
    7,
  );

  if (vacancyRows.length > 0) {
    const wsVagas = wb.addWorksheet("Vagas por curso e turma", {
      views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
    });
    wsVagas.getCell(1, 1).value = "Vagas por curso e turma";
    wsVagas.getCell(1, 1).font = TITLE_FONT;
    wsVagas.mergeCells(1, 1, 1, 15);
    addExcelTable(
      wsVagas,
      "TabelaVagasTurma",
      [
        "Curso",
        "Início",
        "Horários",
        "Dias",
        "Turma",
        "Local",
        "Polo",
        "Coordenador",
        "Professor",
        "Matriculados",
        "Formados",
        "Capacidade",
        "Ocupação %",
        "Ativas",
        "Canceladas",
      ],
      vacancyRows.map((row) => [
        row.courseName,
        row.startDate,
        row.schedule,
        row.days,
        row.turmaLabel,
        row.locationName,
        row.poloName ?? "",
        row.coordinatorName ?? "",
        row.teacher,
        row.enrolled,
        row.graduated,
        row.capacity || null,
        row.occupancyPercent,
        row.active,
        row.cancelled,
      ]),
      2,
    );
  }

  if (locationSections.length > 0) {
    const wsLocal = wb.addWorksheet("Vagas por local", {
      views: [{ showGridLines: false }],
    });
    wsLocal.getCell(1, 1).value = "Turmas organizadas por local (polo e coordenador no cabeçalho)";
    wsLocal.getCell(1, 1).font = TITLE_FONT;
    wsLocal.mergeCells(1, 1, 1, 7);
    let rowIdx = 3;
    for (const section of locationSections) {
      wsLocal.mergeCells(rowIdx, 1, rowIdx, 7);
      const header = wsLocal.getCell(rowIdx, 1);
      header.value = section.locationHeader.toUpperCase();
      header.font = { ...BODY_FONT, bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
      header.alignment = { vertical: "middle" };
      wsLocal.getRow(rowIdx).height = 22;
      rowIdx += 1;

      const headers = ["Início", "Horários", "Dias", "Turma", "Professor", "Matriculados", "Formados"];
      const headerRow = wsLocal.getRow(rowIdx);
      headers.forEach((h, i) => {
        headerRow.getCell(i + 1).value = h;
      });
      styleHeader(headerRow, headers.length);
      rowIdx += 1;

      section.rows.forEach((row, idx) => {
        const dataRow = wsLocal.getRow(rowIdx);
        [
          row.startDate,
          row.schedule,
          row.days,
          row.turmaLabel,
          row.teacher,
          row.enrolled,
          row.graduated,
        ].forEach((value, col) => {
          const cell = dataRow.getCell(col + 1);
          cell.value = value;
          if (typeof value === "number") cell.alignment = { horizontal: "right", vertical: "middle" };
        });
        styleBody(dataRow, 7, idx % 2 === 1);
        rowIdx += 1;
      });

      wsLocal.mergeCells(rowIdx, 1, rowIdx, 7);
      const sub = wsLocal.getCell(rowIdx, 1);
      sub.value = `Subtotal: ${section.subtotal.enrolled} matriculados | Capacidade: ${section.subtotal.capacity} | Vagas disponíveis: ${section.subtotal.available} | Formados: ${section.subtotal.graduated}`;
      sub.font = { ...BODY_FONT, italic: true };
      rowIdx += 2;
    }
    fitColumns(wsLocal, 12, 48);
  }

  const enrollmentRows = params.enrollmentRows ?? [];
  if (enrollmentRows.length > 0) {
    const headers = Object.keys(enrollmentRows[0]!);
    const wsMat = wb.addWorksheet("Matrículas", {
      views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
    });
    wsMat.getCell(1, 1).value = "Lista de matrículas do filtro atual";
    wsMat.getCell(1, 1).font = TITLE_FONT;
    wsMat.mergeCells(1, 1, 1, headers.length);
    addExcelTable(
      wsMat,
      "TabelaMatriculas",
      headers,
      enrollmentRows.map((row) => headers.map((h) => row[h] ?? "")),
      2,
    );
  }

  const wsCharts = wb.addWorksheet("Gráficos", {
    views: [{ showGridLines: false }],
  });
  wsCharts.getCell(1, 1).value = "Gráficos do relatório de vagas";
  wsCharts.getCell(1, 1).font = TITLE_FONT;
  wsCharts.mergeCells(1, 1, 1, 6);
  wsCharts.getColumn(1).width = 18;

  const charts = [
    drawKpiStripPng({
      title: "Indicadores do recorte",
      metrics: [
        { label: "Matriculados", value: String(enrolledTotal) },
        { label: "Formados", value: String(graduatedTotal) },
        { label: "Capacidade", value: String(capacityTotal) },
        { label: "Ocupação", value: occupancy != null ? `${occupancy}%` : "—" },
      ],
    }),
    drawGroupedBarChartPng({
      title: "Matriculados × formados por curso",
      items: byCourse.map((row) => ({
        label: row.courseName,
        primary: row.enrolled,
        secondary: row.graduated,
      })),
      primaryLabel: "Matriculados",
      secondaryLabel: "Formados",
    }),
    drawGroupedBarChartPng({
      title: "Matriculados × formados por local",
      items: byLocation.slice(0, 12).map((row) => ({
        label: row.location,
        primary: row.enrolled,
        secondary: row.graduated,
      })),
      primaryLabel: "Matriculados",
      secondaryLabel: "Formados",
    }),
    drawGroupedBarChartPng({
      title: "Matriculados × formados por professor",
      items: byTeacher.slice(0, 12).map((row) => ({
        label: row.teacher,
        primary: row.enrolled,
        secondary: row.graduated,
      })),
      primaryLabel: "Matriculados",
      secondaryLabel: "Formados",
    }),
  ];

  let anchorRow = 3;
  for (const chart of charts) {
    if (!chart) continue;
    const imageId = wb.addImage({
      buffer: chart.bytes as unknown as ExcelJS.Buffer,
      extension: "png",
    });
    const rows = Math.ceil((chart.height * 0.85) / 18);
    wsCharts.addImage(imageId, {
      tl: { col: 0.2, row: anchorRow - 1 },
      ext: { width: chart.width * 0.85, height: chart.height * 0.85 },
    });
    anchorRow += rows + 2;
  }

  const dataStart = Math.max(anchorRow + 2, 42);
  wsCharts.getCell(dataStart, 1).value = "Dados-fonte dos gráficos (por curso)";
  wsCharts.getCell(dataStart, 1).font = { ...BODY_FONT, bold: true };
  addExcelTable(
    wsCharts,
    "TabelaDadosGraficosCurso",
    ["Curso", "Matriculados", "Formados", "Capacidade"],
    byCourse.map((row) => [row.courseName, row.enrolled, row.graduated, row.capacity]),
    dataStart + 1,
  );

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
