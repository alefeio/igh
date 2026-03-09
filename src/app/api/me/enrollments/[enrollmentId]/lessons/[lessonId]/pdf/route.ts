import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireRole } from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import { contentRichToPdfBlocks } from "@/lib/lesson-pdf";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-data";

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 58;
const WATERMARK_OPACITY = 0.09;
const LOGO_HEADER_MAX_HEIGHT = 28;
const WATERMARK_SIZE_RATIO = 0.5; // logo como marca d'água ocupa 50% da largura da página
const FONT_SIZE_TITLE = 18;
const FONT_SIZE_HEADING = 12;
const FONT_SIZE_BODY = 11;
const FONT_SIZE_H1 = 16;
const FONT_SIZE_H2 = 14;
const FONT_SIZE_H3 = 12;
const FONT_SIZE_CODE = 9;
const LINE_HEIGHT_BODY = 14;
const LINE_HEIGHT_HEADING = 18;
const LINE_HEIGHT_CODE = 11;
const CHARS_PER_LINE = 75;
const CODE_CHARS_PER_LINE = 82;
const BULLET_INDENT = 18;
const QUOTE_INDENT = 24;
const MAX_IMAGE_HEIGHT = 380;

/** Converte texto para caracteres compatíveis com WinAnsi (Helvetica no pdf-lib). */
function toWinAnsiSafe(text: string): string {
  const replacements: [RegExp | string, string][] = [
    ["→", "->"],
    ["←", "<-"],
    ["↑", "^"],
    ["↓", "v"],
    ["⇒", "=>"],
    ["⇐", "<="],
    ["•", "-"],
    ["–", "-"],
    ["—", "-"],
    ["\"", '"'],
    ["\"", '"'],
    ["'", "'"],
    ["'", "'"],
    ["…", "..."],
  ];
  let out = text;
  for (const [from, to] of replacements) {
    out = out.split(from as string).join(to);
  }
  // Substitui qualquer outro caractere fora do Latin-1/WinAnsi por espaço
  return out.replace(/[\u0100-\uFFFF]/g, " ");
}

function drawWatermark(page: PDFPage, logoImage: PDFImage | null): void {
  if (!logoImage) return;
  const w = logoImage.width;
  const h = logoImage.height;
  const maxW = PAGE_WIDTH * WATERMARK_SIZE_RATIO;
  const scale = maxW / w;
  const drawW = maxW;
  const drawH = h * scale;
  const x = (PAGE_WIDTH - drawW) / 2;
  const y = (PAGE_HEIGHT - drawH) / 2;
  page.drawImage(logoImage, {
    x,
    y,
    width: drawW,
    height: drawH,
    opacity: WATERMARK_OPACITY,
  });
}

function drawHeader(
  page: PDFPage,
  opts: {
    font: PDFFont,
    fontBold: PDFFont,
    logoImage: PDFImage | null,
    siteName: string | null,
    courseName: string,
    moduleTitle: string,
    lessonTitle: string,
    toWinAnsi: (t: string) => string,
  }
): void {
  const { font, fontBold, logoImage, siteName, courseName, moduleTitle, lessonTitle, toWinAnsi } = opts;
  const black = rgb(0, 0, 0);
  const darkGray = rgb(0.25, 0.25, 0.25);
  const headerY = PAGE_HEIGHT - 12;
  let leftX = MARGIN;

  if (logoImage) {
    const iw = logoImage.width;
    const ih = logoImage.height;
    const logoH = Math.min(LOGO_HEADER_MAX_HEIGHT, ih);
    const logoW = (iw / ih) * logoH;
    page.drawImage(logoImage, {
      x: leftX,
      y: headerY - logoH,
      width: logoW,
      height: logoH,
    });
    leftX += logoW + 14;
  }

  const sizeSmall = 7;
  const sizeTitle = 10;
  const lineHeight = 10;
  let y = headerY;

  if (siteName && siteName.trim()) {
    const instituteLine = toWinAnsi(siteName.trim().length <= 60 ? siteName.trim() : siteName.trim().slice(0, 57) + "...");
    page.drawText(instituteLine, {
      x: leftX,
      y: y - sizeSmall,
      size: sizeSmall,
      font,
      color: darkGray,
    });
    y -= lineHeight;
  }

  const courseModuleLine = toWinAnsi(`Curso: ${courseName} · Módulo: ${moduleTitle}`);
  page.drawText(courseModuleLine.length <= 72 ? courseModuleLine : toWinAnsi(`Curso: ${courseName}`), {
    x: leftX,
    y: y - sizeSmall,
    size: sizeSmall,
    font,
    color: darkGray,
  });
  y -= lineHeight;

  const lessonLine = toWinAnsi(lessonTitle.length <= 55 ? lessonTitle : lessonTitle.slice(0, 52) + "...");
  page.drawText(lessonLine, {
    x: leftX,
    y: y - sizeTitle,
    size: sizeTitle,
    font: fontBold,
    color: black,
  });

  const lineY = PAGE_HEIGHT - HEADER_HEIGHT + 4;
  page.drawLine({
    start: { x: MARGIN, y: lineY },
    end: { x: PAGE_WIDTH - MARGIN, y: lineY },
    thickness: 0.5,
    color: darkGray,
  });
}

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
  const bodyBlocks = contentRichToPdfBlocks(lesson.contentRich ?? "");
  const hasContent = summaryText.length > 0 || bodyBlocks.length > 0;
  if (!hasContent) {
    return jsonErr("BAD_REQUEST", "Esta aula não possui conteúdo para gerar o PDF.", 400);
  }

  const [course, siteSettings] = await Promise.all([
    prisma.course.findUnique({
      where: { id: enrollment.classGroup.courseId },
      select: { name: true },
    }),
    getSiteSettings(),
  ]);
  const courseName = course?.name ?? "Curso";
  const moduleTitle = lesson.module.title;
  const lessonTitle = lesson.title;
  const siteName = siteSettings?.siteName ?? null;

  const logoUrl = siteSettings?.logoUrl ?? null;
  const pdfDoc = await PDFDocument.create();
  let logoImage: PDFImage | null = null;
  if (logoUrl && logoUrl.startsWith("http")) {
    try {
      const imgRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) });
      if (imgRes.ok) {
        const contentType = imgRes.headers.get("content-type") ?? "";
        const bytes = new Uint8Array(await imgRes.arrayBuffer());
        const isPng = contentType.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50);
        const isJpeg = contentType.includes("jpeg") || contentType.includes("jpg") || (bytes[0] === 0xff && bytes[1] === 0xd8);
        if (isPng) logoImage = await pdfDoc.embedPng(bytes);
        else if (isJpeg) logoImage = await pdfDoc.embedJpg(bytes);
      }
    } catch {
      // ignora falha ao carregar logo
    }
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);
  const black = rgb(0, 0, 0);
  const darkGray = rgb(0.25, 0.25, 0.25);
  const quoteGray = rgb(0.35, 0.35, 0.35);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawWatermark(page, logoImage);
  drawHeader(page, {
    font,
    fontBold,
    logoImage,
    siteName,
    courseName,
    moduleTitle,
    lessonTitle,
    toWinAnsi: toWinAnsiSafe,
  });
  let y = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT;

  function ensureSpace(needed: number): void {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawWatermark(page, logoImage);
      drawHeader(page, {
        font,
        fontBold,
        logoImage,
        siteName,
        courseName,
        moduleTitle,
        lessonTitle,
        toWinAnsi: toWinAnsiSafe,
      });
      y = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT;
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
    page.drawText(toWinAnsiSafe(line), {
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
  const moduleLine = toWinAnsiSafe(`Módulo: ${lesson.module.title}`);
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
    page.drawText(toWinAnsiSafe("Resumo rápido da aula – O que você vai aprender:"), {
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
      page.drawText(toWinAnsiSafe(line), { x: MARGIN, y, size: FONT_SIZE_BODY, font, color: black });
      y -= LINE_HEIGHT_BODY;
    }
    y -= 16;
  }

  // Conteúdo (formatado como no HTML: títulos, listas, citações, código)
  if (bodyBlocks.length > 0) {
    ensureSpace(LINE_HEIGHT_HEADING + 5);
    page.drawText(toWinAnsiSafe("Conteúdo:"), {
      x: MARGIN,
      y,
      size: FONT_SIZE_HEADING,
      font: fontBold,
      color: black,
    });
    y -= LINE_HEIGHT_HEADING + 4;

    function wrapCodeLines(text: string, maxChars: number): string[] {
      const out: string[] = [];
      for (const line of text.split(/\n/)) {
        let rest = line;
        while (rest.length > 0) {
          if (rest.length <= maxChars) {
            out.push(rest);
            break;
          }
          out.push(rest.slice(0, maxChars));
          rest = rest.slice(maxChars);
        }
      }
      return out;
    }

    for (const block of bodyBlocks) {
      if (block.type === "heading1") {
        ensureSpace(LINE_HEIGHT_HEADING + 8);
        const lines = wrapLines(block.text, 50);
        for (const line of lines) {
          page.drawText(toWinAnsiSafe(line), { x: MARGIN, y, size: FONT_SIZE_H1, font: fontBold, color: black });
          y -= LINE_HEIGHT_HEADING;
        }
        y -= 6;
        continue;
      }
      if (block.type === "heading2") {
        ensureSpace(LINE_HEIGHT_HEADING + 6);
        const lines = wrapLines(block.text, 55);
        for (const line of lines) {
          page.drawText(toWinAnsiSafe(line), { x: MARGIN, y, size: FONT_SIZE_H2, font: fontBold, color: black });
          y -= LINE_HEIGHT_HEADING - 1;
        }
        y -= 4;
        continue;
      }
      if (block.type === "heading3") {
        ensureSpace(LINE_HEIGHT_HEADING + 4);
        const lines = wrapLines(block.text, 60);
        for (const line of lines) {
          page.drawText(toWinAnsiSafe(line), { x: MARGIN, y, size: FONT_SIZE_H3, font: fontBold, color: black });
          y -= LINE_HEIGHT_BODY + 2;
        }
        y -= 2;
        continue;
      }
      if (block.type === "paragraph") {
        const lines = wrapLines(block.text, CHARS_PER_LINE);
        for (const line of lines) {
          ensureSpace(LINE_HEIGHT_BODY);
          page.drawText(toWinAnsiSafe(line || " "), { x: MARGIN, y, size: FONT_SIZE_BODY, font, color: black });
          y -= LINE_HEIGHT_BODY;
        }
        y -= 4;
        continue;
      }
      if (block.type === "bullet") {
        const indent = MARGIN + BULLET_INDENT * (block.level + 1);
        const prefix = "- ";
        const lines = wrapLines(block.text, CHARS_PER_LINE - Math.ceil(prefix.length));
        if (lines.length > 0) {
          ensureSpace(LINE_HEIGHT_BODY * lines.length);
          page.drawText(toWinAnsiSafe(prefix + lines[0]), { x: MARGIN, y, size: FONT_SIZE_BODY, font, color: black });
          y -= LINE_HEIGHT_BODY;
          for (let i = 1; i < lines.length; i++) {
            page.drawText(toWinAnsiSafe(lines[i]), { x: indent, y, size: FONT_SIZE_BODY, font, color: black });
            y -= LINE_HEIGHT_BODY;
          }
        }
        y -= 2;
        continue;
      }
      if (block.type === "ordered") {
        const prefix = `${block.number}. `;
        const indent = MARGIN + BULLET_INDENT;
        const lines = wrapLines(block.text, CHARS_PER_LINE - prefix.length);
        if (lines.length > 0) {
          ensureSpace(LINE_HEIGHT_BODY * lines.length);
          page.drawText(toWinAnsiSafe(prefix + lines[0]), { x: MARGIN, y, size: FONT_SIZE_BODY, font, color: black });
          y -= LINE_HEIGHT_BODY;
          for (let i = 1; i < lines.length; i++) {
            page.drawText(toWinAnsiSafe(lines[i]), { x: indent, y, size: FONT_SIZE_BODY, font, color: black });
            y -= LINE_HEIGHT_BODY;
          }
        }
        y -= 2;
        continue;
      }
      if (block.type === "blockquote") {
        const lines = wrapLines(block.text, CHARS_PER_LINE - 2);
        for (const line of lines) {
          ensureSpace(LINE_HEIGHT_BODY);
          page.drawText(toWinAnsiSafe(line || " "), {
            x: MARGIN + QUOTE_INDENT,
            y,
            size: FONT_SIZE_BODY,
            font,
            color: quoteGray,
          });
          y -= LINE_HEIGHT_BODY;
        }
        y -= 4;
        continue;
      }
      if (block.type === "code") {
        const codeLines = wrapCodeLines(block.text, CODE_CHARS_PER_LINE);
        ensureSpace(codeLines.length * LINE_HEIGHT_CODE + 8);
        y -= 4;
        for (const line of codeLines) {
          ensureSpace(LINE_HEIGHT_CODE);
          page.drawText(toWinAnsiSafe(line || " "), {
            x: MARGIN + 12,
            y,
            size: FONT_SIZE_CODE,
            font: fontCourier,
            color: black,
          });
          y -= LINE_HEIGHT_CODE;
        }
        y -= 6;
        continue;
      }
      if (block.type === "image") {
        try {
          const imgRes = await fetch(block.url, { signal: AbortSignal.timeout(15000) });
          if (!imgRes.ok) continue;
          const contentType = imgRes.headers.get("content-type") ?? "";
          const bytes = new Uint8Array(await imgRes.arrayBuffer());
          const isPng = contentType.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50);
          const isJpeg = contentType.includes("jpeg") || contentType.includes("jpg") || (bytes[0] === 0xff && bytes[1] === 0xd8);
          let img: PDFImage;
          if (isPng) {
            img = await pdfDoc.embedPng(bytes);
          } else if (isJpeg) {
            img = await pdfDoc.embedJpg(bytes);
          } else {
            continue;
          }
          const iw = img.width;
          const ih = img.height;
          let drawWidth = CONTENT_WIDTH;
          let drawHeight = (ih / iw) * drawWidth;
          if (drawHeight > MAX_IMAGE_HEIGHT) {
            drawHeight = MAX_IMAGE_HEIGHT;
            drawWidth = (iw / ih) * drawHeight;
          }
          ensureSpace(drawHeight + 12);
          y -= 6;
          page.drawImage(img, {
            x: MARGIN,
            y: y - drawHeight,
            width: drawWidth,
            height: drawHeight,
          });
          y -= drawHeight + 6;
        } catch {
          // ignorar falha de fetch/embed (URL inválida, timeout, etc.)
        }
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  const filename = `aula-${lesson.title.slice(0, 30).replace(/[^a-zA-Z0-9\u00C0-\u00FF\-]/g, "-")}.pdf`;
  const copy = new Uint8Array(pdfBytes.length);
  copy.set(pdfBytes);
  const body: BodyInit = new Blob([copy.buffer as ArrayBuffer], { type: "application/pdf" });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
    },
  });
}
