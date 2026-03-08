import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireRole } from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import { contentRichToPlainText } from "@/lib/lesson-pdf";
import { prisma } from "@/lib/prisma";

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_SIZE_TITLE = 18;
const FONT_SIZE_HEADING = 12;
const FONT_SIZE_BODY = 11;
const LINE_HEIGHT_BODY = 14;
const LINE_HEIGHT_HEADING = 18;
const CHARS_PER_LINE = 75; // aproximação para fonte 11

/** Gera PDF da aula a partir do conteúdo (título, resumo, conteúdo rico). Apenas STUDENT. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    include: { classGroup: { select: { courseId: true } } },
  });
  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true, title: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const summaryText = (lesson.summary ?? "").trim();
  const bodyText = contentRichToPlainText(lesson.contentRich ?? "").trim();
  const hasContent = summaryText.length > 0 || bodyText.length > 0;
  if (!hasContent) {
    return jsonErr("BAD_REQUEST", "Esta aula não possui conteúdo para gerar o PDF.", 400);
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const darkGray = rgb(0.25, 0.25, 0.25);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(needed: number): void {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function wrapLines(text: string, maxChars: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split(/\n/);
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) {
        lines.push("");
        continue;
      }
      let rest = trimmed;
      while (rest.length > 0) {
        if (rest.length <= maxChars) {
          lines.push(rest);
          break;
        }
        let breakAt = rest.lastIndexOf(" ", maxChars);
        if (breakAt <= 0) breakAt = maxChars;
        lines.push(rest.slice(0, breakAt).trim());
        rest = rest.slice(breakAt).trim();
      }
    }
    return lines;
  }

  // Título da aula
  const titleLines = wrapLines(lesson.title, 50);
  ensureSpace(titleLines.length * LINE_HEIGHT_HEADING + 10);
  for (const line of titleLines) {
    page.drawText(line, {
      x: MARGIN,
      y,
      size: FONT_SIZE_TITLE,
      font: fontBold,
      color: black,
    });
    y -= LINE_HEIGHT_HEADING;
  }
  y -= 10;

  // Módulo (opcional)
  const moduleLine = `Módulo: ${lesson.module.title}`;
  ensureSpace(LINE_HEIGHT_BODY);
  page.drawText(moduleLine, {
    x: MARGIN,
    y,
    size: FONT_SIZE_BODY - 1,
    font,
    color: darkGray,
  });
  y -= LINE_HEIGHT_BODY + 12;

  // Resumo rápido
  if (summaryText) {
    ensureSpace(LINE_HEIGHT_HEADING + 5);
    page.drawText("Resumo rápido da aula – O que você vai aprender:", {
      x: MARGIN,
      y,
      size: FONT_SIZE_HEADING,
      font: fontBold,
      color: black,
    });
    y -= LINE_HEIGHT_HEADING + 4;

    const summaryLines = wrapLines(summaryText, CHARS_PER_LINE);
    for (const line of summaryLines) {
      ensureSpace(LINE_HEIGHT_BODY);
      page.drawText(line, { x: MARGIN, y, size: FONT_SIZE_BODY, font, color: black });
      y -= LINE_HEIGHT_BODY;
    }
    y -= 16;
  }

  // Conteúdo
  if (bodyText) {
    ensureSpace(LINE_HEIGHT_HEADING + 5);
    page.drawText("Conteúdo:", {
      x: MARGIN,
      y,
      size: FONT_SIZE_HEADING,
      font: fontBold,
      color: black,
    });
    y -= LINE_HEIGHT_HEADING + 4;

    const bodyLines = wrapLines(bodyText, CHARS_PER_LINE);
    for (const line of bodyLines) {
      ensureSpace(LINE_HEIGHT_BODY);
      page.drawText(line || " ", { x: MARGIN, y, size: FONT_SIZE_BODY, font, color: black });
      y -= LINE_HEIGHT_BODY;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const filename = `aula-${lesson.title.slice(0, 30).replace(/[^a-zA-Z0-9\u00C0-\u00FF\-]/g, "-")}.pdf`;

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
    },
  });
}
