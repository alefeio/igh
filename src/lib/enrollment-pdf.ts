import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const MARGIN = 40;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_SIZE_TITLE = 16;
const FONT_SIZE_HEADING = 12;
const FONT_SIZE_BODY = 9;
const LINE_HEIGHT = 13;
const ROW_HEIGHT = 14;
const CHART_ROW_HEIGHT = 22;
const CHART_BAR_X = 240;
const CHART_MAX_BAR_WIDTH = 280;
const CHART_BAR_HEIGHT_PX = 14;

/** Converte texto para exibição no PDF (remove caracteres não WinAnsi). */
function toPdfText(text: string): string {
  const map: Record<string, string> = {
    á: "a", à: "a", ã: "a", â: "a", ä: "a",
    é: "e", ê: "e", ë: "e",
    í: "i", ï: "i",
    ó: "o", ô: "o", õ: "o", ö: "o",
    ú: "u", ü: "u",
    ç: "c",
    Á: "A", À: "A", Ã: "A", Â: "A",
    É: "E", Ê: "E",
    Í: "I",
    Ó: "O", Ô: "O", Õ: "O",
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
  formatDateOnly: (v: string) => string;
}): Promise<Blob> {
  const { kpis, pieData, columnData, courses, teachersData, formatDateOnly } = params;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.15, 0.15, 0.15);
  const gray = rgb(0.4, 0.4, 0.4);
  const primary = rgb(0, 0.4, 0.7);

  let y = PAGE_HEIGHT - MARGIN;
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  function drawText(
    text: string,
    opts: { x: number; y: number; size?: number; font?: typeof font | typeof fontBold; color?: ReturnType<typeof rgb> }
  ) {
    const f = opts.font ?? font;
    const size = opts.size ?? FONT_SIZE_BODY;
    const color = opts.color ?? black;
    page.drawText(toPdfText(text), { x: opts.x, y: opts.y, size, font: f, color });
  }

  function newPageIfNeeded(needed: number): void {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  const title = "Relatorio de Matriculas";
  drawText(title, { x: MARGIN, y, size: FONT_SIZE_TITLE, font: fontBold });
  y -= LINE_HEIGHT + 4;
  drawText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, { x: MARGIN, y, size: FONT_SIZE_BODY - 1, color: gray });
  y -= LINE_HEIGHT + 12;

  newPageIfNeeded(120);
  drawText("Resumo", { x: MARGIN, y, size: FONT_SIZE_HEADING, font: fontBold });
  y -= LINE_HEIGHT;
  drawText(`Total de matriculas: ${kpis.total}`, { x: MARGIN, y });
  y -= LINE_HEIGHT;
  drawText(`Matriculas ativas: ${kpis.active}`, { x: MARGIN, y });
  y -= LINE_HEIGHT;
  drawText(`Pre-matriculas: ${kpis.pre}`, { x: MARGIN, y });
  y -= LINE_HEIGHT;
  drawText(`Confirmadas: ${kpis.confirmed}`, { x: MARGIN, y });
  y -= LINE_HEIGHT + 12;

  if (pieData.length > 0) {
    newPageIfNeeded(60 + pieData.length * CHART_ROW_HEIGHT);
    drawText("Matriculas por curso", { x: MARGIN, y, size: FONT_SIZE_HEADING, font: fontBold });
    y -= LINE_HEIGHT + 6;
    const totalPie = pieData.reduce((s, d) => s + d.value, 0);
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
      const d = pieData[i];
      const pct = totalPie > 0 ? (d.value / totalPie) * 100 : 0;
      const barW = totalPie > 0 ? (d.value / totalPie) * CHART_MAX_BAR_WIDTH : 0;
      const label = `${toPdfText(d.name).slice(0, 32)}${d.name.length > 32 ? "..." : ""}`;
      drawText(`${label}  ${d.value} (${pct.toFixed(1)}%)`, { x: MARGIN, y, size: FONT_SIZE_BODY - 1 });
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
    newPageIfNeeded(60 + columnData.length * CHART_ROW_HEIGHT);
    drawText("Matriculas por dia", { x: MARGIN, y, size: FONT_SIZE_HEADING, font: fontBold });
    y -= LINE_HEIGHT + 6;
    const maxQty = Math.max(...columnData.map((d) => d.quantidade), 1);
    for (let i = 0; i < columnData.length; i++) {
      const d = columnData[i];
      const barW = (d.quantidade / maxQty) * CHART_MAX_BAR_WIDTH;
      drawText(`${d.data}  ${d.quantidade}`, { x: MARGIN, y, size: FONT_SIZE_BODY - 1 });
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

  if (courses.length > 0) {
    newPageIfNeeded(60);
    drawText("Vagas por curso e turma", { x: MARGIN, y, size: FONT_SIZE_HEADING, font: fontBold });
    y -= LINE_HEIGHT + 4;
    for (const [, { courseName, turmas }] of courses) {
      newPageIfNeeded(30 + turmas.length * ROW_HEIGHT);
      drawText(toPdfText(courseName), { x: MARGIN, y, size: FONT_SIZE_BODY, font: fontBold });
      y -= ROW_HEIGHT;
      for (const { classGroup: cg, count } of turmas) {
        const cap = cg.capacity ?? 0;
        const start = formatDateOnly(cg.startDate).slice(0, 5);
        const days = Array.isArray(cg.daysOfWeek) ? cg.daysOfWeek.join(", ") : "";
        const loc = cg.location ? ` - ${cg.location}` : "";
        drawText(`  ${start} ${cg.startTime}-${cg.endTime}${days ? ` (${days})` : ""}${loc}: ${count}/${cap || "-"}`, {
          x: MARGIN,
          y,
          size: FONT_SIZE_BODY - 1,
        });
        y -= ROW_HEIGHT;
      }
      y -= 4;
    }
    y -= 8;
  }

  if (teachersData.length > 0) {
    newPageIfNeeded(80);
    drawText("Por professor", { x: MARGIN, y, size: FONT_SIZE_HEADING, font: fontBold });
    y -= LINE_HEIGHT + 4;
    for (const { teacher, turmas, totalAlunos } of teachersData) {
      newPageIfNeeded(30 + turmas.length * ROW_HEIGHT);
      drawText(`${toPdfText(teacher.name)}  Total: ${totalAlunos} aluno(s)`, {
        x: MARGIN,
        y,
        size: FONT_SIZE_BODY,
        font: fontBold,
      });
      y -= ROW_HEIGHT;
      const byCourse = new Map<string, { name: string; list: { cg: ClassGroupForPdf; count: number }[] }>();
      for (const t of turmas) {
        const cid = t.classGroup.course?.name ?? "";
        if (!byCourse.has(cid)) byCourse.set(cid, { name: t.classGroup.course?.name ?? "", list: [] });
        byCourse.get(cid)!.list.push({ cg: t.classGroup, count: t.count });
      }
      const courseEntries = Array.from(byCourse.entries()).sort((a, b) =>
        (a[1].name || "").localeCompare(b[1].name || "", "pt-BR")
      );
      for (const [, { name: courseName, list }] of courseEntries) {
        drawText(`  ${toPdfText(courseName)}`, { x: MARGIN, y, size: FONT_SIZE_BODY - 1 });
        y -= ROW_HEIGHT;
        for (const { cg, count } of list) {
          const start = formatDateOnly(cg.startDate).slice(0, 5);
          const days = Array.isArray(cg.daysOfWeek) ? cg.daysOfWeek.join(", ") : "";
          drawText(`    Turma ${start} ${cg.startTime}-${cg.endTime}${days ? ` (${days})` : ""}: ${count} aluno(s)`, {
            x: MARGIN,
            y,
            size: FONT_SIZE_BODY - 1,
          });
          y -= ROW_HEIGHT;
        }
      }
      y -= 4;
    }
    y -= 8;
  }

  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
