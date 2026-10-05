import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { drawGroupedBarChartPng, drawKpiStripPng } from "@/lib/enrollment-chart-canvas";
import type { EnrollmentVacancyRow } from "@/lib/enrollment-vacancy-report";
import {
  groupVacancyRowsByLocation,
  summarizeVacanciesByCourse,
  summarizeVacanciesByLocation,
  summarizeVacanciesByTeacher,
} from "@/lib/enrollment-vacancy-report";

const MARGIN = 36;
const PAGE = { width: 595, height: 842 };
const LANDSCAPE = { width: 842, height: 595 };

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

/**
 * PDF executivo: indicadores + gráficos claros.
 * Detalhamento por local fica no final, em volume reduzido.
 */
export async function buildEnrollmentPdfBlob(params: {
  kpis: Kpis;
  vacancyRows: EnrollmentVacancyRow[];
  formatDateOnly: (v: string) => string;
  /** Mantidos por compatibilidade; o resumo visual usa vacancyRows. */
  pieData?: unknown;
  columnData?: unknown;
  courses?: unknown;
  teachersData?: unknown;
}): Promise<Blob> {
  const { kpis, vacancyRows } = params;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.1, 0.12, 0.16);
  const gray = rgb(0.4, 0.45, 0.5);
  const navy = rgb(0.12, 0.3, 0.47);

  const byCourse = summarizeVacanciesByCourse(vacancyRows);
  const byTeacher = summarizeVacanciesByTeacher(vacancyRows);
  const byLocation = summarizeVacanciesByLocation(vacancyRows);
  const locationSections = groupVacancyRowsByLocation(vacancyRows);

  const enrolledTotal = vacancyRows.reduce((s, r) => s + r.enrolled, 0);
  const graduatedTotal = vacancyRows.reduce((s, r) => s + r.graduated, 0);
  const capacityTotal = vacancyRows.reduce((s, r) => s + r.capacity, 0);
  const occupancy = capacityTotal > 0 ? Math.round((enrolledTotal / capacityTotal) * 100) : null;
  const available = Math.max(0, capacityTotal - enrolledTotal);

  // Página 1 — capa / indicadores
  {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    let y = PAGE.height - MARGIN;
    page.drawText(toPdfText("Relatorio de Vagas e Formacao"), {
      x: MARGIN,
      y,
      size: 18,
      font: fontBold,
      color: navy,
    });
    y -= 18;
    page.drawText(toPdfText(`Gerado em ${new Date().toLocaleString("pt-BR")}`), {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: gray,
    });
    y -= 28;

    page.drawText(toPdfText("Leitura rapida"), {
      x: MARGIN,
      y,
      size: 12,
      font: fontBold,
      color: black,
    });
    y -= 16;
    page.drawText(
      toPdfText(
        "Matriculados = alunos que ocupam vaga agora. Formados = aptos a certificado ou concluidos.",
      ),
      { x: MARGIN, y, size: 9, font, color: gray },
    );
    y -= 24;

    const cards: Array<{ label: string; value: string }> = [
      { label: "Matriculados", value: String(enrolledTotal) },
      { label: "Formados", value: String(graduatedTotal) },
      { label: "Capacidade", value: String(capacityTotal) },
      { label: "Ocupacao", value: occupancy != null ? `${occupancy}%` : "—" },
      { label: "Vagas livres", value: String(available) },
      { label: "Turmas", value: String(vacancyRows.length) },
    ];
    const cardW = 160;
    const cardH = 58;
    cards.forEach((card, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = MARGIN + col * (cardW + 12);
      const cy = y - row * (cardH + 12);
      page.drawRectangle({
        x,
        y: cy - cardH,
        width: cardW,
        height: cardH,
        color: rgb(0.96, 0.97, 0.98),
        borderColor: rgb(0.8, 0.84, 0.88),
        borderWidth: 1,
      });
      page.drawText(toPdfText(card.label), {
        x: x + 12,
        y: cy - 18,
        size: 9,
        font,
        color: gray,
      });
      page.drawText(toPdfText(card.value), {
        x: x + 12,
        y: cy - 42,
        size: 20,
        font: fontBold,
        color: black,
      });
    });
    y -= 2 * (cardH + 12) + 16;

    page.drawText(toPdfText("Contexto do filtro de matriculas"), {
      x: MARGIN,
      y,
      size: 11,
      font: fontBold,
      color: black,
    });
    y -= 16;
    const contextLines = [
      `Total no filtro: ${kpis.total}`,
      `Ativas: ${kpis.active}`,
      `Pre-matriculas: ${kpis.pre}`,
      `Confirmadas: ${kpis.confirmed}`,
    ];
    for (const line of contextLines) {
      page.drawText(toPdfText(line), { x: MARGIN, y, size: 10, font, color: black });
      y -= 14;
    }

    y -= 10;
    page.drawText(toPdfText("Top cursos (matriculados / formados)"), {
      x: MARGIN,
      y,
      size: 11,
      font: fontBold,
      color: black,
    });
    y -= 16;
    for (const row of byCourse.slice(0, 8)) {
      page.drawText(
        toPdfText(`${row.courseName}: ${row.enrolled} matriculados · ${row.graduated} formados`),
        { x: MARGIN, y, size: 9, font, color: black },
      );
      y -= 13;
      if (y < MARGIN + 40) break;
    }
  }

  async function addChartPage(
    title: string,
    chart: ReturnType<typeof drawGroupedBarChartPng> | ReturnType<typeof drawKpiStripPng>,
  ) {
    if (!chart) return;
    const page = doc.addPage([LANDSCAPE.width, LANDSCAPE.height]);
    page.drawText(toPdfText(title), {
      x: MARGIN,
      y: LANDSCAPE.height - MARGIN,
      size: 14,
      font: fontBold,
      color: navy,
    });
    const png = await doc.embedPng(chart.bytes);
    const maxW = LANDSCAPE.width - MARGIN * 2;
    const maxH = LANDSCAPE.height - MARGIN * 2 - 28;
    const scale = Math.min(maxW / chart.width, maxH / chart.height);
    const w = chart.width * scale;
    const h = chart.height * scale;
    page.drawImage(png, {
      x: MARGIN,
      y: LANDSCAPE.height - MARGIN - 24 - h,
      width: w,
      height: h,
    });
  }

  const kpiStrip = drawKpiStripPng({
    title: "Indicadores do recorte",
    metrics: [
      { label: "Matriculados", value: String(enrolledTotal) },
      { label: "Formados", value: String(graduatedTotal) },
      { label: "Capacidade", value: String(capacityTotal) },
      { label: "Ocupacao", value: occupancy != null ? `${occupancy}%` : "—" },
    ],
  });
  await addChartPage("Visao geral", kpiStrip);

  await addChartPage(
    "Por curso",
    drawGroupedBarChartPng({
      title: "Matriculados x formados por curso",
      items: byCourse.map((row) => ({
        label: row.courseName,
        primary: row.enrolled,
        secondary: row.graduated,
      })),
      primaryLabel: "Matriculados",
      secondaryLabel: "Formados",
    }),
  );

  await addChartPage(
    "Por local",
    drawGroupedBarChartPng({
      title: "Matriculados x formados por local",
      items: byLocation.slice(0, 12).map((row) => ({
        label: row.location,
        primary: row.enrolled,
        secondary: row.graduated,
      })),
      primaryLabel: "Matriculados",
      secondaryLabel: "Formados",
    }),
  );

  await addChartPage(
    "Por professor",
    drawGroupedBarChartPng({
      title: "Matriculados x formados por professor",
      items: byTeacher.slice(0, 12).map((row) => ({
        label: row.teacher,
        primary: row.enrolled,
        secondary: row.graduated,
      })),
      primaryLabel: "Matriculados",
      secondaryLabel: "Formados",
    }),
  );

  // Anexo curto por local (somente subtotais + até 4 turmas por bloco)
  if (locationSections.length > 0) {
    let page = doc.addPage([LANDSCAPE.width, LANDSCAPE.height]);
    let y = LANDSCAPE.height - MARGIN;
    page.drawText(toPdfText("Anexo: subtotais por local"), {
      x: MARGIN,
      y,
      size: 14,
      font: fontBold,
      color: navy,
    });
    y -= 22;
    page.drawText(
      toPdfText("Detalhe completo das turmas esta na planilha Excel (abas com filtro)."),
      { x: MARGIN, y, size: 9, font, color: gray },
    );
    y -= 20;

    for (const section of locationSections) {
      if (y < 80) {
        page = doc.addPage([LANDSCAPE.width, LANDSCAPE.height]);
        y = LANDSCAPE.height - MARGIN;
      }
      page.drawText(toPdfText(section.locationHeader).slice(0, 110), {
        x: MARGIN,
        y,
        size: 10,
        font: fontBold,
        color: black,
      });
      y -= 14;
      page.drawText(
        toPdfText(
          `Matriculados ${section.subtotal.enrolled} · Formados ${section.subtotal.graduated} · Capacidade ${section.subtotal.capacity} · Livres ${section.subtotal.available}`,
        ),
        { x: MARGIN, y, size: 9, font, color: gray },
      );
      y -= 18;
    }
  }

  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
