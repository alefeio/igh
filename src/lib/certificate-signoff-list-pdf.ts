import fs from "node:fs";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PNG } from "pngjs";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import { formatDaysShortPtBr } from "@/lib/turma-display";

const FONT_REGULAR_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf");
const FONT_BOLD_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Bold.ttf");

export type CertificateSignoffClassGroup = {
  courseName: string;
  teacherName: string;
  cycle: number;
  year: number;
  location: string | null;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
};

export type CertificateSignoffStudent = {
  name: string;
};

export function certificateSignoffTitleLines(group: CertificateSignoffClassGroup): string[] {
  const place = group.location?.trim();
  const days = formatDaysShortPtBr(group.daysOfWeek);
  const schedule = `${days} · ${group.startTime}–${group.endTime}`;
  const turma = place ? `${place} · ${schedule}` : schedule;
  return [
    `Ciclo ${group.cycle}/${group.year}`,
    `Turma: ${turma}`,
    `Curso: ${group.courseName.trim() || "Curso"}`,
    `Professor: ${group.teacherName.trim() || "Professor"}`,
  ];
}

export function sortCertificateSignoffNames(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

function flattenPngOnWhite(bytes: Uint8Array): Uint8Array {
  const png = PNG.sync.read(Buffer.from(bytes));
  for (let i = 0; i < png.data.length; i += 4) {
    const alpha = png.data[i + 3]! / 255;
    png.data[i] = Math.round(png.data[i]! * alpha + 255 * (1 - alpha));
    png.data[i + 1] = Math.round(png.data[i + 1]! * alpha + 255 * (1 - alpha));
    png.data[i + 2] = Math.round(png.data[i + 2]! * alpha + 255 * (1 - alpha));
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

async function embedLogo(doc: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  try {
    if (isPng) return await doc.embedPng(flattenPngOnWhite(bytes));
    if (isJpeg) return await doc.embedJpg(bytes);
  } catch {
    return null;
  }
  return null;
}
function drawFitted(
  page: PDFPage,
  text: string,
  font: PDFFont,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color: ReturnType<typeof rgb>,
) {
  let fontSize = size;
  while (fontSize > 8 && font.widthOfTextAtSize(text, fontSize) > maxWidth) {
    fontSize -= 0.5;
  }
  page.drawText(text, { x, y, size: fontSize, font, color });
}

/** PDF A4 com nomes à esquerda e espaço de assinatura à direita. */
export async function buildCertificateSignoffListPdf(params: {
  group: CertificateSignoffClassGroup;
  students: CertificateSignoffStudent[];
  /** Bytes baixados de SiteSettings.logoUrl (Configurações do site). */
  logoBytes?: Uint8Array | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fs.readFileSync(FONT_REGULAR_PATH));
  const bold = await doc.embedFont(fs.readFileSync(FONT_BOLD_PATH));
  const logo = params.logoBytes ? await embedLogo(doc, params.logoBytes) : null;
  if (params.logoBytes && !logo) {
    throw new Error("A logomarca configurada não pôde ser incluída no PDF. Use PNG ou JPEG.");
  }

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const ink = rgb(0.12, 0.14, 0.18);
  const line = rgb(0.35, 0.38, 0.42);
  const names = sortCertificateSignoffNames(params.students.map((s) => s.name.trim() || "Aluno"));
  const titles = certificateSignoffTitleLines(params.group);

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function paintHeader(target: PDFPage, top: number) {
    let cursor = top;
    if (logo) {
      const maxW = 140;
      const maxH = 52;
      const scale = Math.min(maxW / logo.width, maxH / logo.height);
      const w = logo.width * scale;
      const h = logo.height * scale;
      target.drawImage(logo, {
        x: (pageWidth - w) / 2,
        y: cursor - h,
        width: w,
        height: h,
      });
      cursor -= h + 16;
    }
    for (const title of titles) {
      drawFitted(target, title, bold, margin, cursor, pageWidth - margin * 2, 14, ink);
      cursor -= 20;
    }
    cursor -= 8;
    target.drawText("Nome", { x: margin, y: cursor, size: 10, font: bold, color: ink });
    target.drawText("Assinatura", {
      x: pageWidth - margin - 150,
      y: cursor,
      size: 10,
      font: bold,
      color: ink,
    });
    cursor -= 8;
    target.drawLine({
      start: { x: margin, y: cursor },
      end: { x: pageWidth - margin, y: cursor },
      thickness: 0.6,
      color: line,
    });
    return cursor - 22;
  }

  y = paintHeader(page, y);

  for (const name of names) {
    if (y < margin + 24) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = paintHeader(page, pageHeight - margin);
    }
    const nameMax = pageWidth - margin * 2 - 190;
    drawFitted(page, name, regular, margin, y, nameMax, 12, ink);
    const lineStart = pageWidth - margin - 170;
    page.drawLine({
      start: { x: lineStart, y: y - 2 },
      end: { x: pageWidth - margin, y: y - 2 },
      thickness: 0.8,
      color: line,
    });
    y -= 28;
  }

  if (names.length === 0) {
    page.drawText("Nenhum aluno habilitado para certificado nesta turma.", {
      x: margin,
      y,
      size: 11,
      font: regular,
      color: ink,
    });
  }

  return doc.save();
}
