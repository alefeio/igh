import "server-only";

import type { PDFFont, PDFPage } from "pdf-lib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Helvetica WinAnsi: remove acentos para evitar erro de desenho. */
function pdfSafe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\xFF]/g, "?");
}

const COL = {
  cardBorder: rgb(0.88, 0.88, 0.9),
  cardBg: rgb(0.99, 0.99, 1),
  muted: rgb(0.45, 0.45, 0.48),
};

/** Data, Aluno, Turma, Plat., Aulas, Prof. (sem e-mail, como solicitado no PDF). */
const TABLE_COLS = [
  { title: "Data", w: 64 },
  { title: "Aluno", w: 78 },
  { title: "Turma", w: 92 },
  { title: "Plat.", w: 50 },
  { title: "Aulas", w: 50 },
  { title: "Prof.", w: 100 },
] as const;

export type PlatformExperiencePdfSummary = {
  totalCount: number;
  avgPlatform: number | null;
  minPlatform: number | null;
  maxPlatform: number | null;
  avgLessons: number | null;
  minLessons: number | null;
  maxLessons: number | null;
  avgTeacher: number | null;
  minTeacher: number | null;
  maxTeacher: number | null;
};

export type PlatformExperiencePdfRow = {
  dateLabel: string;
  userName: string;
  turmaLabel: string;
  plat: number;
  aulas: number;
  prof: number;
  commentPlatform: string;
  commentLessons: string;
  /** Linha acima do comentário (nomes), só quando há comentário sobre o professor. */
  teacherNamesLine: string | null;
  commentTeacher: string;
  referral: string;
};

function fmtAvg(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function fmtInt(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return String(n);
}

function cell(s: string): string {
  return pdfSafe(s).replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

function chunkLine(s: string, maxChars: number): string[] {
  const safe = pdfSafe(s);
  if (safe.length <= maxChars) return [safe];
  const lines: string[] = [];
  for (let i = 0; i < safe.length; i += maxChars) {
    lines.push(safe.slice(i, i + maxChars));
  }
  return lines;
}

function wrapLines(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const t = pdfSafe(text);
  if (!t) return [];
  const words = t.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function drawPlainColumn(
  page: PDFPage,
  text: string,
  x: number,
  yTop: number,
  colW: number,
  font: PDFFont,
): number {
  const inner = colW - 4;
  const lines = wrapLines(text, inner, font, 7);
  const lineGap = 9;
  let y = yTop;
  for (const ln of lines) {
    page.drawText(ln, {
      x: x + 2,
      y,
      size: 7,
      font,
      color: rgb(0.12, 0.12, 0.12),
      maxWidth: inner,
    });
    y -= lineGap;
  }
  return y;
}

function drawRatingColumn(
  page: PDFPage,
  rating: number,
  comment: string,
  x: number,
  yTop: number,
  colW: number,
  font: PDFFont,
  fontBold: PDFFont,
): number {
  const inner = colW - 4;
  const lineGap = 9;
  let y = yTop;
  page.drawText(String(rating), {
    x: x + 2,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.12, 0.12, 0.12),
  });
  y -= 11;
  const c = comment?.trim();
  if (c) {
    for (const ln of wrapLines(c, inner, font, 7)) {
      page.drawText(ln, {
        x: x + 2,
        y,
        size: 7,
        font,
        color: rgb(0.35, 0.35, 0.38),
        maxWidth: inner,
      });
      y -= lineGap;
    }
  }
  return y;
}

function drawProfColumn(
  page: PDFPage,
  rating: number,
  teacherNamesLine: string | null,
  commentTeacher: string,
  x: number,
  yTop: number,
  colW: number,
  font: PDFFont,
  fontBold: PDFFont,
): number {
  const inner = colW - 4;
  const lineGap = 9;
  let y = yTop;
  page.drawText(String(rating), {
    x: x + 2,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.12, 0.12, 0.12),
  });
  y -= 11;
  const ct = commentTeacher?.trim();
  if (teacherNamesLine && ct) {
    for (const ln of wrapLines(teacherNamesLine, inner, font, 7)) {
      page.drawText(ln, {
        x: x + 2,
        y,
        size: 7,
        font,
        color: rgb(0.45, 0.45, 0.48),
        maxWidth: inner,
      });
      y -= lineGap;
    }
    for (const ln of wrapLines(ct, inner, font, 7)) {
      page.drawText(ln, {
        x: x + 2,
        y,
        size: 7,
        font,
        color: rgb(0.25, 0.25, 0.28),
        maxWidth: inner,
      });
      y -= lineGap;
    }
  } else if (ct) {
    for (const ln of wrapLines(ct, inner, font, 7)) {
      page.drawText(ln, {
        x: x + 2,
        y,
        size: 7,
        font,
        color: rgb(0.35, 0.35, 0.38),
        maxWidth: inner,
      });
      y -= lineGap;
    }
  }
  return y;
}

export async function buildPlatformExperiencePdf(
  title: string,
  summary: PlatformExperiencePdfSummary,
  rows: PlatformExperiencePdfRow[],
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

  /* --- Cards (Total + Plataforma + Aulas + Professor) --- */
  drawLine("Resumo (cards)", { bold: true, size: 10 });
  y -= 6;
  const cardH = 58;
  const cardGap = 6;
  const cardW = (pageW - margin * 2 - 3 * cardGap) / 4;
  ensureSpace(cardH + 28);
  const cardBottomY = y - 6 - cardH;

  const cards: { label: string; line1: string; line2?: string }[] = [
    { label: "Total", line1: String(summary.totalCount) },
    {
      label: "Plataforma",
      line1: `${fmtAvg(summary.avgPlatform)} /10`,
      line2: `Melhor ${fmtInt(summary.maxPlatform)}/10 | Pior ${fmtInt(summary.minPlatform)}/10`,
    },
    {
      label: "Aulas",
      line1: `${fmtAvg(summary.avgLessons)} /10`,
      line2: `Melhor ${fmtInt(summary.maxLessons)}/10 | Pior ${fmtInt(summary.minLessons)}/10`,
    },
    {
      label: "Professor",
      line1: `${fmtAvg(summary.avgTeacher)} /10`,
      line2: `Melhor ${fmtInt(summary.maxTeacher)}/10 | Pior ${fmtInt(summary.minTeacher)}/10`,
    },
  ];

  for (let i = 0; i < 4; i++) {
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
    const c = cards[i];
    page.drawText(pdfSafe(c.label), {
      x: x + 5,
      y: cardBottomY + cardH - 14,
      size: 6.5,
      font,
      color: COL.muted,
      maxWidth: cardW - 10,
    });
    page.drawText(pdfSafe(c.line1), {
      x: x + 5,
      y: cardBottomY + cardH - 30,
      size: 11,
      font: fontBold,
      color: rgb(0.12, 0.12, 0.12),
      maxWidth: cardW - 10,
    });
    if (c.line2) {
      page.drawText(pdfSafe(c.line2), {
        x: x + 5,
        y: cardBottomY + cardH - 46,
        size: 5.8,
        font,
        color: rgb(0.35, 0.35, 0.38),
        maxWidth: cardW - 10,
      });
    }
  }

  y = cardBottomY - 16;

  /* --- Indicacoes --- */
  ensureSpace(36);
  drawLine("Indicacoes (aluno e texto)", { bold: true, size: 10 });
  y -= 4;
  drawLine("Aluno | Indicacao", { bold: true, size: 7.5 });
  y -= 2;

  const referralRows = rows.filter((r) => Boolean(r.referral?.trim()));
  if (rows.length === 0) {
    drawLine("Nenhum registro no filtro.", { size: 8 });
    y -= 4;
  } else if (referralRows.length === 0) {
    drawLine("Nenhum texto de indicacao informado.", { size: 8 });
    y -= 4;
  } else {
    for (const r of referralRows) {
      const aluno = cell(r.userName);
      const ind = cell(r.referral?.trim() ?? "");
      const line = `${aluno} | ${ind}`;
      for (const part of chunkLine(line, 92)) {
        drawLine(part, { size: 7.5 });
      }
      y -= 2;
    }
  }

  y -= 8;

  /* --- Tabela principal (mesma estrutura da tela) --- */
  ensureSpace(48);
  drawLine("Avaliacoes (tabela)", { bold: true, size: 10 });
  y -= 6;

  const colStarts: number[] = [];
  let xAcc = margin;
  for (const c of TABLE_COLS) {
    colStarts.push(xAcc);
    xAcc += c.w;
  }

  const headerY = y;
  for (let i = 0; i < TABLE_COLS.length; i++) {
    page.drawText(pdfSafe(TABLE_COLS[i].title), {
      x: colStarts[i] + 2,
      y: headerY,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.12),
      maxWidth: TABLE_COLS[i].w - 4,
    });
  }
  y = headerY - 14;

  for (const r of rows) {
    ensureSpace(160);
    const rowTop = y;
    const bottoms: number[] = [];

    bottoms.push(drawPlainColumn(page, r.dateLabel, colStarts[0], rowTop, TABLE_COLS[0].w, font));
    bottoms.push(drawPlainColumn(page, r.userName, colStarts[1], rowTop, TABLE_COLS[1].w, font));
    bottoms.push(drawPlainColumn(page, r.turmaLabel, colStarts[2], rowTop, TABLE_COLS[2].w, font));
    bottoms.push(
      drawRatingColumn(
        page,
        r.plat,
        r.commentPlatform,
        colStarts[3],
        rowTop,
        TABLE_COLS[3].w,
        font,
        fontBold,
      ),
    );
    bottoms.push(
      drawRatingColumn(
        page,
        r.aulas,
        r.commentLessons,
        colStarts[4],
        rowTop,
        TABLE_COLS[4].w,
        font,
        fontBold,
      ),
    );
    bottoms.push(
      drawProfColumn(
        page,
        r.prof,
        r.teacherNamesLine,
        r.commentTeacher,
        colStarts[5],
        rowTop,
        TABLE_COLS[5].w,
        font,
        fontBold,
      ),
    );

    const rowBottom = Math.min(...bottoms);
    y = rowBottom - 10;
  }

  return pdf.save();
}
