import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { EnrollmentVacancyRow } from "@/lib/enrollment-vacancy-report";
import { summarizeVacanciesByCourse, summarizeVacanciesByLocation, summarizeVacanciesByTeacher } from "@/lib/enrollment-vacancy-report";

const MARGIN = 36;
const PORTRAIT = { width: 595, height: 842 };
const LANDSCAPE = { width: 842, height: 595 };
const FONT_SIZE_TITLE = 16;
const FONT_SIZE_HEADING = 12;
const FONT_SIZE_BODY = 9;
const LINE_HEIGHT = 13;
const ROW_HEIGHT = 14;
const CHART_ROW_HEIGHT = 20;
const CHART_BAR_X = 260;
const CHART_MAX_BAR_WIDTH = 300;
const CHART_BAR_HEIGHT_PX = 12;

/** Converte texto para exibição no PDF (remove caracteres não WinAnsi). */
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
  };
  let out = text;
  for (const [from, to] of Object.entries(map)) {
    out = out.split(from).join(to);
  }
  return out.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, " ");
}

interface Kpis {
  total: number;
  active: number;
  pre: number;
  confirmed: number;
}

interface PieItem {
  name: string;
  value: number;
}

interface ColumnItem {
  data: string;
  quantidade: number;
}

interface ClassGroupForPdf {
  course: { name: string };
  startDate: string;
  startTime: string;
  endTime: string;
  daysOfWeek: string[];
  location?: string | null;
  capacity?: number;
  teacher?: { name: string } | null;
}

interface TeacherForPdf {
  id: string;
  name: string;
}

export async function buildEnrollmentPdfBlob(params: {
  kpis: Kpis;
  pieData: PieItem[];
  columnData: ColumnItem[];
  courses: Array<[string, { courseName: string; turmas: { classGroup: ClassGroupForPdf; count: number }[] }]>;
  teachersData: Array<{ teacher: TeacherForPdf; turmas: { classGroup: ClassGroupForPdf; count: number }[]; totalAlunos: number }>;
  vacancyRows: EnrollmentVacancyRow[];
  formatDateOnly: (v: string) => string;
}): Promise<Blob> {
  const { kpis, pieData, columnData, teachersData, vacancyRows, formatDateOnly } = params;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.15, 0.15, 0.15);
  const gray = rgb(0.4, 0.4, 0.4);
  const primary = rgb(0, 0.4, 0.7);
  const accent = rgb(0.86, 0.15, 0.15);
  const green = rgb(0.05, 0.55, 0.3);

  let pageSize = PORTRAIT;
  let y = pageSize.height - MARGIN;
  let page = doc.addPage([pageSize.width, pageSize.height]);

  function drawText(
    text: string,
    opts: { x: number; y: number; size?: number; font?: typeof font | typeof fontBold; color?: ReturnType<typeof rgb> },
  ) {
    const f = opts.font ?? font;
    const size = opts.size ?? FONT_SIZE_BODY;
    const color = opts.color ?? black;
    page.drawText(toPdfText(text), { x: opts.x, y: opts.y, size, font: f, color });
  }

  function ensurePage(needed: number, nextSize = pageSize): void {
    if (y - needed < MARGIN || nextSize.width !== pageSize.width) {
      pageSize = nextSize;
      page = doc.addPage([pageSize.width, pageSize.height]);
      y = pageSize.height - MARGIN;
    }
  }

  function drawBarChart(
    title: string,
    items: { label: string; value: number; secondary?: number }[],
    primaryLabel: string,
    secondaryLabel?: string,
  ) {
    if (items.length === 0) return;
    ensurePage(70 + items.length * CHART_ROW_HEIGHT);
    drawText(title, { x: MARGIN, y, size: FONT_SIZE_HEADING, font: fontBold });
    y -= LINE_HEIGHT + 4;
    const maxValue = Math.max(...items.map((item) => Math.max(item.value, item.secondary ?? 0)), 1);
    for (const item of items) {
      ensurePage(CHART_ROW_HEIGHT + 4);
      const label = `${toPdfText(item.label).slice(0, 36)}${item.label.length > 36 ? "..." : ""}`;
      const primaryText =
        item.secondary == null
          ? `${item.value}`
          : `${primaryLabel} ${item.value} | ${secondaryLabel ?? "sec"} ${item.secondary}`;
      drawText(`${label}  ${primaryText}`, { x: MARGIN, y, size: FONT_SIZE_BODY - 1 });
      const barW = (item.value / maxValue) * CHART_MAX_BAR_WIDTH;
      if (barW > 0) {
        page.drawRectangle({
          x: CHART_BAR_X,
          y: y - CHART_BAR_HEIGHT_PX - 2,
          width: barW,
          height: CHART_BAR_HEIGHT_PX,
          color: primary,
        });
      }
      if (item.secondary != null && item.secondary > 0) {
        const secondaryW = (item.secondary / maxValue) * CHART_MAX_BAR_WIDTH;
        page.drawRectangle({
          x: CHART_BAR_X,
          y: y - CHART_BAR_HEIGHT_PX - 2,
          width: secondaryW,
          height: Math.max(4, CHART_BAR_HEIGHT_PX / 2),
          color: green,
        });
      }
      y -= CHART_ROW_HEIGHT;
    }
    y -= 10;
  }

  drawText("Relatorio de Matriculas", { x: MARGIN, y, size: FONT_SIZE_TITLE, font: fontBold });
  y -= LINE_HEIGHT + 4;
  drawText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, { x: MARGIN, y, size: FONT_SIZE_BODY - 1, color: gray });
  y -= LINE_HEIGHT + 12;

  ensurePage(120);
  drawText("Resumo", { x: MARGIN, y, size: FONT_SIZE_HEADING, font: fontBold });
  y -= LINE_HEIGHT;
  drawText(`Total de matriculas: ${kpis.total}`, { x: MARGIN, y });
  y -= LINE_HEIGHT;
  drawText(`Matriculas ativas: ${kpis.active}`, { x: MARGIN, y });
  y -= LINE_HEIGHT;
  drawText(`Pre-matriculas: ${kpis.pre}`, { x: MARGIN, y });
  y -= LINE_HEIGHT;
  drawText(`Confirmadas: ${kpis.confirmed}`, { x: MARGIN, y });
  y -= LINE_HEIGHT;
  const graduatedTotal = vacancyRows.reduce((sum, row) => sum + row.graduated, 0);
  const enrolledTotal = vacancyRows.reduce((sum, row) => sum + row.enrolled, 0);
  drawText(`Matriculados nas turmas (ocupacao): ${enrolledTotal}`, { x: MARGIN, y });
  y -= LINE_HEIGHT;
  drawText(`Formados (concluidos): ${graduatedTotal}`, { x: MARGIN, y });
  y -= LINE_HEIGHT + 12;

  if (pieData.length > 0) {
    ensurePage(60 + pieData.length * CHART_ROW_HEIGHT);
    drawText("Matriculas por curso", { x: MARGIN, y, size: FONT_SIZE_HEADING, font: fontBold });
    y -= LINE_HEIGHT + 6;
    const totalPie = pieData.reduce((sum, item) => sum + item.value, 0);
    const colors = [
      rgb(0, 0.4, 0.7),
      rgb(0.1, 0.2, 0.36),
      rgb(0.91, 0.46, 0),
      rgb(0.05, 0.58, 0.53),
      rgb(0.49, 0.23, 0.93),
      rgb(0.86, 0.15, 0.15),
      rgb(0.4, 0.64, 0.05),
      rgb(0.79, 0.54, 0.02),
    ];
    for (let i = 0; i < pieData.length; i++) {
      const item = pieData[i];
      const pct = totalPie > 0 ? (item.value / totalPie) * 100 : 0;
      const barW = totalPie > 0 ? (item.value / totalPie) * CHART_MAX_BAR_WIDTH : 0;
      const label = `${toPdfText(item.name).slice(0, 32)}${item.name.length > 32 ? "..." : ""}`;
      drawText(`${label}  ${item.value} (${pct.toFixed(1)}%)`, { x: MARGIN, y, size: FONT_SIZE_BODY - 1 });
      if (barW > 0) {
        page.drawRectangle({
          x: CHART_BAR_X,
          y: y - CHART_BAR_HEIGHT_PX - 4,
          width: barW,
          height: CHART_BAR_HEIGHT_PX,
          color: colors[i % colors.length],
        });
      }
      y -= CHART_ROW_HEIGHT;
    }
    y -= 12;
  }

  if (columnData.length > 0) {
    ensurePage(60 + Math.min(columnData.length, 20) * CHART_ROW_HEIGHT);
    drawText("Matriculas por dia", { x: MARGIN, y, size: FONT_SIZE_HEADING, font: fontBold });
    y -= LINE_HEIGHT + 6;
    const maxQty = Math.max(...columnData.map((item) => item.quantidade), 1);
    for (const item of columnData.slice(-30)) {
      ensurePage(CHART_ROW_HEIGHT + 4);
      const barW = (item.quantidade / maxQty) * CHART_MAX_BAR_WIDTH;
      drawText(`${item.data}  ${item.quantidade}`, { x: MARGIN, y, size: FONT_SIZE_BODY - 1 });
      if (barW > 0) {
        page.drawRectangle({
          x: CHART_BAR_X,
          y: y - CHART_BAR_HEIGHT_PX - 4,
          width: barW,
          height: CHART_BAR_HEIGHT_PX,
          color: primary,
        });
      }
      y -= CHART_ROW_HEIGHT;
    }
    y -= 12;
  }

  const byCourse = summarizeVacanciesByCourse(vacancyRows);
  drawBarChart(
    "Matriculados x formados por curso",
    byCourse.map((row) => ({ label: row.courseName, value: row.enrolled, secondary: row.graduated })),
    "Matriculados",
    "Formados",
  );

  const byTeacher = summarizeVacanciesByTeacher(vacancyRows).slice(0, 20);
  drawBarChart(
    "Matriculados x formados por professor",
    byTeacher.map((row) => ({ label: row.teacher, value: row.enrolled, secondary: row.graduated })),
    "Matriculados",
    "Formados",
  );

  const byLocation = summarizeVacanciesByLocation(vacancyRows).slice(0, 20);
  drawBarChart(
    "Matriculados por local/polo",
    byLocation.map((row) => ({ label: row.location, value: row.enrolled, secondary: row.graduated })),
    "Matriculados",
    "Formados",
  );

  if (vacancyRows.length > 0) {
    ensurePage(80, LANDSCAPE);
    drawText("Vagas por curso e turma", { x: MARGIN, y, size: FONT_SIZE_HEADING, font: fontBold });
    y -= LINE_HEIGHT + 2;
    drawText("Inicio | Horarios | Dias | Turma | Local | Professor | Matriculados | Formados | Capacidade", {
      x: MARGIN,
      y,
      size: FONT_SIZE_BODY - 1,
      font: fontBold,
      color: gray,
    });
    y -= ROW_HEIGHT;
    let currentCourse = "";
    for (const row of vacancyRows) {
      ensurePage(ROW_HEIGHT * 3, LANDSCAPE);
      if (row.courseName !== currentCourse) {
        currentCourse = row.courseName;
        drawText(toPdfText(row.courseName), { x: MARGIN, y, size: FONT_SIZE_BODY, font: fontBold });
        y -= ROW_HEIGHT;
      }
      const line = [
        row.startDate,
        row.schedule,
        row.days,
        row.turmaLabel,
        row.location,
        row.teacher,
        String(row.enrolled),
        String(row.graduated),
        row.capacity > 0 ? String(row.capacity) : "-",
      ]
        .map((part) => toPdfText(part).slice(0, 28))
        .join(" | ");
      drawText(line, { x: MARGIN, y, size: FONT_SIZE_BODY - 2, color: row.occupancyPercent != null && row.occupancyPercent >= 100 ? accent : black });
      y -= ROW_HEIGHT;
    }
    y -= 8;
  }

  if (teachersData.length > 0) {
    ensurePage(80, PORTRAIT);
    drawText("Por professor (detalhe)", { x: MARGIN, y, size: FONT_SIZE_HEADING, font: fontBold });
    y -= LINE_HEIGHT + 4;
    for (const { teacher, turmas, totalAlunos } of teachersData) {
      ensurePage(30 + turmas.length * ROW_HEIGHT, PORTRAIT);
      drawText(`${toPdfText(teacher.name)}  Total: ${totalAlunos} aluno(s)`, {
        x: MARGIN,
        y,
        size: FONT_SIZE_BODY,
        font: fontBold,
      });
      y -= ROW_HEIGHT;
      for (const t of turmas) {
        const cg = t.classGroup;
        const start = formatDateOnly(cg.startDate).slice(0, 5);
        const days = Array.isArray(cg.daysOfWeek) ? cg.daysOfWeek.join(", ") : "";
        drawText(`  ${toPdfText(cg.course.name)} · ${start} ${cg.startTime}-${cg.endTime}${days ? ` (${days})` : ""}: ${t.count}`, {
          x: MARGIN,
          y,
          size: FONT_SIZE_BODY - 1,
        });
        y -= ROW_HEIGHT;
      }
      y -= 4;
    }
  }

  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
