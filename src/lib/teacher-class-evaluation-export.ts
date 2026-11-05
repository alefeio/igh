import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { rowsToCsvSemicolon } from "@/lib/csv-export";
import { formatBrazilDate } from "@/lib/format";
import type { PublicTeacherEvaluationRanking } from "@/lib/teacher-class-evaluation";
import type { TeacherClassEvaluationListItem } from "@/lib/teacher-class-evaluation-query";

function pdfSafe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\xFF]/g, "?");
}

function formatAverage(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function buildTeacherEvaluationExportCsv(input: {
  filterLabel: string;
  ranking: PublicTeacherEvaluationRanking[];
  evaluations: TeacherClassEvaluationListItem[];
}): string {
  const rankingHeaders = [
    "Posicao",
    "Professor",
    "Media",
    "Quantidade",
    "Ultima nota",
    "Ultimo aluno",
    "Ultimo curso",
    "Ultima turma",
    "Ultima data",
    "Ultimo comentario",
  ];
  const rankingRows = input.ranking.map((row, index) => [
    String(index + 1),
    row.teacherName,
    formatAverage(row.averageRating),
    String(row.evaluationCount),
    String(row.latest.rating),
    row.latest.authorLabel,
    row.latest.courseName,
    row.latest.classLabel,
    row.latest.at ? formatBrazilDate(row.latest.at) : "",
    row.latest.comment,
  ]);

  const evaluationHeaders = [
    "Data",
    "Professor",
    "Aluno",
    "Curso",
    "Turma",
    "Nota",
    "Anonima para o professor",
    "Comentario",
  ];
  const evaluationRows = input.evaluations.map((row) => [
    formatBrazilDate(row.createdAt),
    row.teacherName,
    row.authorLabel,
    row.courseName,
    row.classLabel,
    String(row.rating),
    row.anonymous ? "sim" : "nao",
    row.comment,
  ]);

  const stripBom = (value: string) => value.replace(/^\ufeff/, "");
  const rankingCsv = stripBom(rowsToCsvSemicolon(rankingHeaders, rankingRows));
  const evaluationCsv = stripBom(rowsToCsvSemicolon(evaluationHeaders, evaluationRows));
  return `\ufeffFiltro;${input.filterLabel}\r\n\r\nRanking dos professores\r\n${rankingCsv}\r\n\r\nAvaliacoes do professor\r\n${evaluationCsv}`;
}

export async function buildTeacherEvaluationExportPdf(input: {
  filterLabel: string;
  ranking: PublicTeacherEvaluationRanking[];
  evaluations: TeacherClassEvaluationListItem[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 42;
  const fontSize = 9;
  const lineH = 12;
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
    ensureSpace(28);
    page.drawText(pdfSafe(text), {
      x: margin,
      y,
      size,
      font: f,
      color: rgb(0.12, 0.12, 0.12),
      maxWidth: pageW - margin * 2,
    });
    y -= lineH * (size / fontSize) * 1.05;
  };

  drawLine("Experiencia do aluno - professores", { bold: true, size: 13 });
  drawLine(`Gerado em ${new Date().toLocaleString("pt-BR")}`, { size: 8 });
  drawLine(`Filtro: ${input.filterLabel}`, { size: 8 });
  y -= 8;

  drawLine("Ranking dos professores", { bold: true, size: 11 });
  if (input.ranking.length === 0) {
    drawLine("Nenhuma avaliacao publica neste recorte.");
  } else {
    for (const [index, row] of input.ranking.entries()) {
      y -= 4;
      drawLine(
        `${index + 1}. ${row.teacherName} - media ${formatAverage(row.averageRating)}/5 - ${row.evaluationCount} avaliacao(oes)`,
        { bold: true },
      );
      drawLine(
        `Ultima: ${row.latest.rating}/5 - ${row.latest.authorLabel} - ${row.latest.courseName}${row.latest.classLabel ? ` - ${row.latest.classLabel}` : ""}${row.latest.at ? ` - ${formatBrazilDate(row.latest.at)}` : ""}`,
        { size: 8 },
      );
      if (row.latest.comment) drawLine(row.latest.comment, { size: 8 });
    }
  }

  y -= 10;
  drawLine("Avaliacoes do professor", { bold: true, size: 11 });
  drawLine(`${input.evaluations.length} registro(s)`, { size: 8 });
  if (input.evaluations.length === 0) {
    drawLine("Nenhuma avaliacao neste recorte.");
  } else {
    for (const row of input.evaluations) {
      y -= 4;
      drawLine(
        `${formatBrazilDate(row.createdAt)} - ${row.teacherName} - ${row.authorLabel} - ${row.rating}/5${row.anonymous ? " - anonima para o professor" : ""}`,
        { bold: true },
      );
      drawLine(`${row.courseName}${row.classLabel ? ` - ${row.classLabel}` : ""}`, { size: 8 });
      if (row.comment) drawLine(row.comment, { size: 8 });
    }
  }

  return pdf.save();
}
