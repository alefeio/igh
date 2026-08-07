import "server-only";

import fs from "fs";
import path from "path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const FONT_REGULAR_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf");
const FONT_BOLD_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Bold.ttf");

type Align = "left" | "center" | "right";
type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string; align: Align }
  | { kind: "paragraph"; text: string; bold: boolean; italic: boolean; align: Align }
  | { kind: "listItem"; text: string; ordered: boolean; index: number };

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function alignFromStyle(attrs: string): Align {
  const m = /text-align:\s*(left|center|right)/i.exec(attrs);
  if (!m) return "left";
  return m[1].toLowerCase() as Align;
}

/** Extrai um subconjunto de blocos TipTap/HTML para desenhar no PDF. */
export function htmlToDocumentBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const normalized = html
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "</p>\n")
    .replace(/<\/h([1-3])>/gi, "</h$1>\n")
    .replace(/<\/li>/gi, "</li>\n");

  const re =
    /<(h([1-3])|p|li)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  let orderedIndex = 0;
  while ((match = re.exec(normalized)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[3] ?? "";
    const inner = match[4] ?? "";
    const text = stripTags(inner);
    if (!text) continue;
    const align = alignFromStyle(attrs);
    const bold = /<(strong|b)\b/i.test(inner);
    const italic = /<(em|i)\b/i.test(inner);

    if (tag === "h1" || tag === "h2" || tag === "h3") {
      blocks.push({ kind: "heading", level: Number(tag[1]) as 1 | 2 | 3, text, align });
      continue;
    }
    if (tag === "li") {
      const ordered = /<ol[\s>]/i.test(normalized.slice(Math.max(0, match.index - 200), match.index));
      if (ordered) orderedIndex += 1;
      else orderedIndex = 0;
      blocks.push({
        kind: "listItem",
        text,
        ordered,
        index: ordered ? orderedIndex : 0,
      });
      continue;
    }
    blocks.push({ kind: "paragraph", text, bold, italic, align });
  }

  if (blocks.length === 0) {
    const fallback = stripTags(html);
    if (fallback) blocks.push({ kind: "paragraph", text: fallback, bold: false, italic: false, align: "left" });
  }
  return blocks;
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function drawAligned(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  align: Align,
) {
  const width = font.widthOfTextAtSize(text, size);
  let drawX = x;
  if (align === "center") drawX = x + (maxWidth - width) / 2;
  if (align === "right") drawX = x + maxWidth - width;
  page.drawText(text, {
    x: Math.max(x, drawX),
    y,
    size,
    font,
    color: rgb(0.08, 0.1, 0.14),
  });
}

/**
 * Converte HTML tipado (parágrafos, títulos, listas, negrito) em PDF A4
 * com as fontes NotoSans já usadas nos certificados.
 */
export async function renderDocumentHtmlToPdfBytes(html: string, title?: string): Promise<Uint8Array> {
  const regularBytes = fs.readFileSync(FONT_REGULAR_PATH);
  const boldBytes = fs.readFileSync(FONT_BOLD_PATH);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontRegular = await doc.embedFont(regularBytes, { subset: true });
  const fontBold = await doc.embedFont(boldBytes, { subset: true });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 54;
  const maxWidth = pageWidth - margin * 2;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  if (title?.trim()) {
    const lines = wrapLines(title.trim(), fontBold, 16, maxWidth);
    for (const line of lines) {
      ensureSpace(22);
      drawAligned(page, line, fontBold, 16, margin, y, maxWidth, "center");
      y -= 22;
    }
    y -= 10;
  }

  const blocks = htmlToDocumentBlocks(html);
  for (const block of blocks) {
    if (block.kind === "heading") {
      const size = block.level === 1 ? 16 : block.level === 2 ? 14 : 12;
      const lines = wrapLines(block.text, fontBold, size, maxWidth);
      for (const line of lines) {
        ensureSpace(size + 8);
        drawAligned(page, line, fontBold, size, margin, y, maxWidth, block.align);
        y -= size + 6;
      }
      y -= 4;
      continue;
    }

    if (block.kind === "listItem") {
      const bullet = block.ordered ? `${block.index}. ` : "• ";
      const font = fontRegular;
      const size = 11;
      const prefixWidth = font.widthOfTextAtSize(bullet, size);
      const lines = wrapLines(block.text, font, size, maxWidth - prefixWidth);
      lines.forEach((line, idx) => {
        ensureSpace(size + 6);
        if (idx === 0) {
          page.drawText(bullet, { x: margin, y, size, font, color: rgb(0.08, 0.1, 0.14) });
        }
        page.drawText(line, {
          x: margin + prefixWidth,
          y,
          size,
          font,
          color: rgb(0.08, 0.1, 0.14),
        });
        y -= size + 5;
      });
      continue;
    }

    const font = block.bold ? fontBold : fontRegular;
    const size = 11;
    const lines = wrapLines(block.text, font, size, maxWidth);
    for (const line of lines) {
      ensureSpace(size + 6);
      drawAligned(page, line, font, size, margin, y, maxWidth, block.align);
      y -= size + 5;
    }
    y -= 4;
  }

  return doc.save();
}
