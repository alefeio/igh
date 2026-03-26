import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import {
  MAX_COURSES_CHART,
  chartRowsForExport,
  type AttendanceGroupForChart,
} from "@/lib/attendance-course-chart";
import type { AttendanceClassGroupSummaryRow, AttendanceTotals } from "@/lib/attendance-session-summary";

/** Helvetica WinAnsi: remove acentos para evitar erro de desenho. */
function pdfSafe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\xFF]/g, "?");
}

const COL = {
  present: rgb(16 / 255, 185 / 255, 129 / 255),
  absent: rgb(244 / 255, 63 / 255, 94 / 255),
  justified: rgb(217 / 255, 119 / 255, 6 / 255),
  cardBorder: rgb(0.88, 0.88, 0.9),
  cardBg: rgb(0.99, 0.99, 1),
  muted: rgb(0.45, 0.45, 0.48),
  barEmpty: rgb(0.92, 0.92, 0.94),
};

function truncateLabel(s: string, max: number): string {
  const t = pdfSafe(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export async function buildAttendanceOverviewPdf(
  title: string,
  rows: AttendanceClassGroupSummaryRow[],
  totals: AttendanceTotals
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 42;
  const fontSize = 8.5;
  const lineH = 11;
  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;

  const ensureSpace = (needed: number) => {
    if (y < margin + needed) {
      page = pdf.addPage([pageW, pageH]);
      y = pageH - margin;
    }
  };

  const drawLine = (text: string, opts?: { bold?: boolean; size?: number }) => {
    const size = opts?.size ?? fontSize;
    const f = opts?.bold ? fontBold : font;
    const safe = pdfSafe(text);
    ensureSpace(28);
    page.drawText(safe, {
      x: margin,
      y,
      size,
      font: f,
      color: rgb(0.12, 0.12, 0.12),
      maxWidth: pageW - margin * 2,
    });
    y -= lineH * (size / fontSize) * 1.05;
  };

  drawLine(title, { bold: true, size: 13 });
  y -= 2;
  drawLine(`Gerado em ${new Date().toLocaleString("pt-BR")}`, { size: 7.5 });
  y -= 10;

  /* --- Cards (mesma ordem e rótulos da tela) --- */
  drawLine("Resumo (cards)", { bold: true, size: 10 });
  y -= 6;
  const cardH = 50;
  const cardGap = 5;
  const cardW = (pageW - margin * 2 - 4 * cardGap) / 5;
  ensureSpace(cardH + 28);
  const cardBottomY = y - 6 - cardH;

  const cardDefs: { label: string; value: string }[] = [
    { label: "Aulas", value: String(totals.sessionCount) },
    { label: "Presencas (soma)", value: String(totals.presentSum) },
    { label: "Ausencias (soma)", value: String(totals.absentSum) },
    { label: "Justif. ausencia (soma)", value: String(totals.justifiedAbsentSum) },
    { label: "Turmas", value: String(totals.classGroupCount) },
  ];

  for (let i = 0; i < 5; i++) {
    const x = margin + i * (cardW + cardGap);
    page.drawRectangle({
      x,
      y: cardBottomY,
      width: cardW,
      height: cardH,
      borderColor: COL.cardBorder,
      borderWidth: 0.8,
      color: COL.cardBg,
    });
    const lab = pdfSafe(cardDefs[i].label);
    const val = pdfSafe(cardDefs[i].value);
    page.drawText(lab, {
      x: x + 5,
      y: cardBottomY + cardH - 14,
      size: 6.5,
      font,
      color: COL.muted,
      maxWidth: cardW - 10,
    });
    const vs = Math.min(12, cardW > 70 ? 11 : 9);
    page.drawText(val, {
      x: x + 5,
      y: cardBottomY + 18,
      size: vs,
      font: fontBold,
      color: rgb(0.12, 0.12, 0.12),
      maxWidth: cardW - 10,
    });
  }

  y = cardBottomY - 14;

  /* --- Gráfico: Distribuição por curso --- */
  const groupsForChart: AttendanceGroupForChart[] = rows.map((r) => ({
    courseId: r.courseId,
    courseName: r.courseName,
    presentSum: r.presentSum,
    absentSum: r.absentSum,
    justifiedAbsentSum: r.justifiedAbsentSum,
  }));
  const { rows: chartRows, truncated: chartTruncated } = chartRowsForExport(groupsForChart, MAX_COURSES_CHART);

  y -= 6;
  ensureSpace(120);
  drawLine("Distribuicao por curso", { bold: true, size: 10 });
  y -= 2;
  drawLine(
    "Cada barra soma todas as turmas do mesmo curso: presencas, ausencias sem justificativa e ausencias justificadas.",
    { size: 7.5 }
  );
  if (chartTruncated) {
    y -= 2;
    drawLine(
      `Mostrando os ${MAX_COURSES_CHART} cursos com maior volume de registros (presencas + ausencias).`,
      { size: 7.5 }
    );
  }
  y -= 6;

  const labelW = 168;
  const barStart = margin + labelW;
  const barMaxW = pageW - margin - barStart - 8;
  const rowGap = 16;
  const barH = 7;

  ensureSpace(22);
  let lx = barStart;
  const leg = (color: ReturnType<typeof rgb>, text: string) => {
    const t = pdfSafe(text);
    const fs = 6.5;
    page.drawRectangle({ x: lx, y: y - 6, width: 8, height: 7, color });
    page.drawText(t, { x: lx + 11, y: y - 4, size: fs, font, color: rgb(0.2, 0.2, 0.2) });
    lx += 11 + font.widthOfTextAtSize(t, fs) + 10;
  };
  leg(COL.present, "Presencas");
  leg(COL.absent, "Aus. sem just.");
  leg(COL.justified, "Aus. just.");
  y -= 22;

  if (chartRows.length === 0) {
    drawLine("Sem dados para o grafico (nenhuma turma no filtro).", { size: 8 });
    y -= 4;
  } else {
    for (const row of chartRows) {
      ensureSpace(rowGap + 18);
      const total = row.present + row.absentSemJust + row.justificada;
      const lab = truncateLabel(row.courseName, 38);
      page.drawText(lab, {
        x: margin,
        y: y - 2,
        size: 7.5,
        font,
        color: rgb(0.15, 0.15, 0.18),
        maxWidth: labelW - 4,
      });

      const bx = barStart;
      const by = y - 4 - barH;
      if (total === 0) {
        page.drawRectangle({ x: bx, y: by, width: 32, height: barH, color: COL.barEmpty });
      } else {
        let xa = bx;
        const w1 = (row.present / total) * barMaxW;
        const w2 = (row.absentSemJust / total) * barMaxW;
        const w3 = (row.justificada / total) * barMaxW;
        const seg = (w: number, color: ReturnType<typeof rgb>) => {
          if (w < 0.01) return;
          const ww = Math.max(w, 0.5);
          page.drawRectangle({ x: xa, y: by, width: ww, height: barH, color });
          xa += ww;
        };
        seg(w1, COL.present);
        seg(w2, COL.absent);
        seg(w3, COL.justified);
      }
      y -= rowGap;
    }
  }

  y -= 8;

  /* --- Tabela: detalhe por turma --- */
  ensureSpace(40);
  drawLine("Detalhe por turma (tabela)", { bold: true, size: 10 });
  y -= 4;
  drawLine(
    "Curso | Turma | Horario | Professor | Presencas / ausencias | Ausencias justificadas",
    { bold: true, size: 7.5 }
  );
  y -= 2;

  for (const r of rows) {
    const presAus = `${r.presentSum} / ${r.absentSum}`;
    const line = [
      r.courseName,
      r.turmaLabel,
      r.horarioLabel,
      r.teacherName,
      presAus,
      String(r.justifiedAbsentSum),
    ].join(" | ");
    const safe = pdfSafe(line);
    const maxChars = 95;
    for (let i = 0; i < safe.length; i += maxChars) {
      drawLine(safe.slice(i, i + maxChars));
    }
  }

  return pdf.save();
}
