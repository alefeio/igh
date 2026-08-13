import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { contentRichToPdfBlocks } from "@/lib/lesson-pdf";
import { getSiteSettings } from "@/lib/site-data";

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 58;
const WATERMARK_OPACITY = 0.09;
const LOGO_HEADER_MAX_HEIGHT = 28;
const WATERMARK_SIZE_RATIO = 0.5;
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
    font: PDFFont;
    fontBold: PDFFont;
    logoImage: PDFImage | null;
    siteName: string | null;
    courseName: string;
    moduleTitle: string;
    lessonTitle: string;
    toWinAnsi: (t: string) => string;
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

export type LessonPdfInput = {
  title: string;
  summary: string | null;
  contentRich: string | null;
  moduleTitle: string;
  courseName: string;
};

export type LessonPdfResult =
  | { ok: true; bytes: Uint8Array; filename: string }
  | { ok: false; reason: "NO_CONTENT" };

/**
 * Gera o PDF da aula a partir do resumo + conteúdo rico (mesmo layout para aluno e professor).
 */
export async function buildLessonPdf(lesson: LessonPdfInput): Promise<LessonPdfResult> {
  const summaryText = (lesson.summary ?? "").trim();
  const bodyBlocks = contentRichToPdfBlocks(lesson.contentRich ?? "");
  const hasContent = summaryText.length > 0 || bodyBlocks.length > 0;
  if (!hasContent) {
    return { ok: false, reason: "NO_CONTENT" };
  }

  const siteSettings = await getSiteSettings();
  const courseName = lesson.courseName || "Curso";
  const moduleTitle = lesson.moduleTitle;
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

  const moduleLine = toWinAnsiSafe(`Módulo: ${lesson.moduleTitle}`);
  ensureSpace(LINE_HEIGHT_BODY);
  page.drawText(moduleLine, {
    x: MARGIN,
    y,
    size: FONT_SIZE_BODY - 1,
    font,
    color: darkGray,
  });
  y -= LINE_HEIGHT_BODY + 12;

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
          // ignorar falha de fetch/embed
        }
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  const filename = `aula-${lesson.title.slice(0, 30).replace(/[^a-zA-Z0-9\u00C0-\u00FF\-]/g, "-")}.pdf`;
  return { ok: true, bytes: pdfBytes, filename };
}

export function lessonPdfResponse(
  result: Extract<LessonPdfResult, { ok: true }>,
  disposition: "inline" | "attachment" = "inline"
): Response {
  const copy = new Uint8Array(result.bytes.length);
  copy.set(result.bytes);
  const body: BodyInit = new Blob([copy.buffer as ArrayBuffer], { type: "application/pdf" });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${result.filename}"`,
      "Content-Length": String(result.bytes.length),
    },
  });
}
