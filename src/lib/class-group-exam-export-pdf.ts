import "server-only";

import type { PDFFont, PDFPage } from "pdf-lib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ExamAttemptPdfReview = {
  attempt: {
    studentName: string;
    examTitle: string;
    status: string;
    scorePercent: number | null;
    correctCount: number | null;
    totalQuestions: number | null;
    submittedAt: string | null;
  };
  questions: {
    order: number;
    questionText: string;
    correct: boolean;
    options: {
      label: string;
      text: string;
      isCorrect: boolean;
      isSelected: boolean;
    }[];
  }[];
};

const STATUS_PT: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  SUBMITTED: "Enviada",
  EXPIRED: "Tempo esgotado",
  ABANDONED: "Encerrada (saida)",
};

function toWinAnsiSafe(input: unknown): string {
  const s = (input ?? "").toString();
  if (!s) return "";
  return s
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/[•∙]/g, "-")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = toWinAnsiSafe(text).split(" ").filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function ensureSpace(
  pdf: PDFDocument,
  pageRef: { page: PDFPage },
  yRef: { y: number },
  needed: number,
  width: number,
  height: number,
  margin: number
) {
  if (yRef.y >= margin + needed) return;
  pageRef.page = pdf.addPage([width, height]);
  yRef.y = height - margin;
}

export async function buildExamAttemptsPdfBytes(
  examTitle: string,
  reviews: ExamAttemptPdfReview[]
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const width = 595.28;
  const height = 841.89;
  const maxWidth = width - margin * 2;

  const pageRef = { page: pdf.addPage([width, height]) };
  const yRef = { y: height - margin };

  pageRef.page.drawText("Provas dos alunos", {
    x: margin,
    y: yRef.y,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yRef.y -= 22;
  pageRef.page.drawText(toWinAnsiSafe(examTitle), {
    x: margin,
    y: yRef.y,
    size: 12,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  yRef.y -= 16;
  pageRef.page.drawText(`Total exportado: ${reviews.length} aluno(s)`, {
    x: margin,
    y: yRef.y,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  yRef.y -= 14;
  pageRef.page.drawText(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, {
    x: margin,
    y: yRef.y,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  yRef.y -= 28;

  for (const review of reviews) {
    ensureSpace(pdf, pageRef, yRef, 72, width, height, margin);

    pageRef.page.drawLine({
      start: { x: margin, y: yRef.y + 8 },
      end: { x: width - margin, y: yRef.y + 8 },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });

    pageRef.page.drawText(toWinAnsiSafe(review.attempt.studentName), {
      x: margin,
      y: yRef.y,
      size: 13,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    yRef.y -= 18;

    const status = STATUS_PT[review.attempt.status] ?? review.attempt.status;
    let meta = `Status: ${status}`;
    if (review.attempt.scorePercent != null) {
      meta += `  |  Acertos: ${review.attempt.correctCount}/${review.attempt.totalQuestions} (${review.attempt.scorePercent}%)`;
    }
    if (review.attempt.submittedAt) {
      meta += `  |  Enviado: ${review.attempt.submittedAt.slice(0, 19).replace("T", " ")}`;
    }
    for (const line of wrapLines(meta, font, 9, maxWidth)) {
      ensureSpace(pdf, pageRef, yRef, 14, width, height, margin);
      pageRef.page.drawText(line, { x: margin, y: yRef.y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
      yRef.y -= 12;
    }
    yRef.y -= 8;

    for (const q of review.questions) {
      ensureSpace(pdf, pageRef, yRef, 40, width, height, margin);

      const qTitle = `Questao ${q.order + 1}${q.correct ? " [ACERTO]" : " [ERRO]"}`;
      pageRef.page.drawText(qTitle, {
        x: margin,
        y: yRef.y,
        size: 10,
        font: fontBold,
        color: q.correct ? rgb(0.1, 0.45, 0.2) : rgb(0.6, 0.1, 0.1),
      });
      yRef.y -= 14;

      for (const line of wrapLines(q.questionText, font, 10, maxWidth)) {
        ensureSpace(pdf, pageRef, yRef, 14, width, height, margin);
        pageRef.page.drawText(line, { x: margin, y: yRef.y, size: 10, font, color: rgb(0, 0, 0) });
        yRef.y -= 12;
      }

      for (const opt of q.options) {
        ensureSpace(pdf, pageRef, yRef, 14, width, height, margin);
        let prefix = `${opt.label} `;
        if (opt.isCorrect) prefix += "[CORRETA] ";
        if (opt.isSelected && !opt.isCorrect) prefix += "[MARCADA] ";
        else if (opt.isSelected) prefix += "[ESCOLHIDA] ";

        const optLine = prefix + opt.text;
        for (const line of wrapLines(optLine, font, 9, maxWidth - 12)) {
          ensureSpace(pdf, pageRef, yRef, 12, width, height, margin);
          const color = opt.isCorrect
            ? rgb(0.15, 0.5, 0.2)
            : opt.isSelected
              ? rgb(0.55, 0.1, 0.1)
              : rgb(0.25, 0.25, 0.25);
          pageRef.page.drawText(line, { x: margin + 8, y: yRef.y, size: 9, font, color });
          yRef.y -= 11;
        }
      }
      yRef.y -= 6;
    }
    yRef.y -= 10;
  }

  return pdf.save();
}
