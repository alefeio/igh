import "server-only";

import fs from "fs";
import path from "path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { isIghDonationTemplate, renderIghDonationTermPdf } from "@/lib/admin/donation-term-igh-pdf";

const TEMPLATE_PATH = path.join(process.cwd(), "assets", "gerencia", "termo-doacao", "modelo.pdf");
const FONT_REGULAR_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf");

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

/** CNPJ impresso no modelo oficial (IA / CRC-INAC). */
const PRINTED_DONOR_CNPJ_DIGITS = "21010850000140";

export type OfficialDonationTermInput = {
  donor: {
    name?: string | null;
    document?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    cep?: string | null;
    representativeName?: string | null;
    representativeRole?: string | null;
    representativeCpf?: string | null;
    email?: string | null;
  };
  donataria: {
    name?: string | null;
    document?: string | null;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    cep?: string | null;
    zone?: string | null;
  };
  donatedAt?: Date | string | null;
  placeDateText?: string | null;
  kitsCount?: number | null;
  items?: Array<{ name: string; quantity: number }>;
  templateTitle?: string | null;
};

function asDate(value: Date | string | null | undefined): Date {
  if (!value) return new Date();
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function dash(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function donatariaAddress(d: OfficialDonationTermInput["donataria"]): string {
  return [d.street, d.number, d.complement, d.neighborhood, d.cep].filter(Boolean).join(", ");
}

function computersQuantity(input: OfficialDonationTermInput): string {
  if (input.kitsCount && input.kitsCount > 0) {
    return input.kitsCount >= 100 ? String(input.kitsCount) : String(input.kitsCount).padStart(2, "0");
  }
  const items = input.items ?? [];
  const computers = items.filter((i) => /computador/i.test(i.name));
  const n = (computers.length > 0 ? computers : items).reduce((sum, i) => sum + (i.quantity || 0), 0);
  return n >= 100 ? String(n) : String(n).padStart(2, "0");
}

function formatPlaceDate(input: OfficialDonationTermInput): string {
  const custom = input.placeDateText?.trim();
  if (custom) return /[.]$/.test(custom) ? custom : `${custom}.`;
  const d = asDate(input.donatedAt);
  const city = dash(input.donor.city) || dash(input.donataria.city);
  const day = d.getUTCDate();
  const month = MONTHS_PT[d.getUTCMonth()] ?? "";
  const year = d.getUTCFullYear();
  const right = `${day} de ${month} de ${year}.`;
  return city ? `${city} / , ${right}` : `/ , ${right}`;
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

function fitFontSizeToWidth(
  text: string,
  font: PDFFont,
  maxWidth: number,
  preferredSize: number,
  minSize: number,
): number {
  let size = preferredSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function paintWhite(page: PDFPage, x: number, y: number, width: number, height: number) {
  page.drawRectangle({ x, y, width, height, color: WHITE, borderWidth: 0 });
}

function draw(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth?: number,
) {
  const value = dash(text);
  if (!value) return;
  const fitted = maxWidth ? fitFontSizeToWidth(value, font, maxWidth, size, 7) : size;
  page.drawText(value, { x, y, size: fitted, font, color: BLACK });
}

function drawWrapped(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  maxLines: number,
) {
  const value = dash(text);
  if (!value) return;
  const lines = wrapLines(value, font, size, maxWidth).slice(0, maxLines);
  lines.forEach((line, idx) => {
    page.drawText(line, { x, y: y - idx * (size + 1), size, font, color: BLACK });
  });
}

function drawRight(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  rightX: number,
  y: number,
) {
  const value = dash(text);
  if (!value) return;
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, { x: rightX - width, y, size, font, color: BLACK });
}

/** O modelo oficial já traz a doadora IA impressa; só reescreve se o CNPJ for outro. */
function shouldRedrawDonor(donor: OfficialDonationTermInput["donor"]): boolean {
  const cnpj = onlyDigits(donor.document);
  return Boolean(cnpj) && cnpj !== PRINTED_DONOR_CNPJ_DIGITS;
}

function drawDonorBlock(page: PDFPage, donor: OfficialDonationTermInput["donor"], font: PDFFont) {
  const size = 11.3;
  paintWhite(page, 118, 668, 412, 16);
  paintWhite(page, 114, 653, 418, 16);
  paintWhite(page, 148, 638, 384, 16);
  paintWhite(page, 144, 623, 390, 16);
  paintWhite(page, 212, 608, 322, 16);
  paintWhite(page, 126, 593, 408, 16);
  paintWhite(page, 106, 578, 428, 16);

  draw(page, dash(donor.name).toUpperCase(), font, size, 121.7, 672.6, 400);
  draw(page, dash(donor.document), font, size, 117.2, 657.6, 200);
  draw(page, dash(donor.phone), font, size, 353, 657.6, 170);
  draw(page, dash(donor.address), font, size, 151.7, 642.6, 370);
  draw(page, dash(donor.city), font, size, 147.2, 627.6, 165);
  draw(page, dash(donor.state), font, size, 368, 627.6, 30);
  draw(page, dash(donor.cep), font, size, 432.6, 627.6, 80);
  draw(page, dash(donor.representativeName), font, size, 214, 612.6, 310);
  draw(page, dash(donor.representativeRole), font, size, 129.9, 597.5, 180);
  draw(page, dash(donor.representativeCpf), font, size, 356, 597.5, 170);
  draw(page, dash(donor.phone), font, size, 108.9, 582.5, 200);
  draw(page, dash(donor.email), font, size, 369.5, 582.5, 160);
}

/**
 * Gera o termo no layout oficial (modelo IA / CRC-INAC), preenchendo
 * donatária, quantidade de computadores, data e assinaturas.
 */
export async function renderOfficialDonationTermPdf(
  input: OfficialDonationTermInput,
): Promise<Uint8Array> {
  if (isIghDonationTemplate(input.templateTitle) || onlyDigits(input.donor.document) === "08633366000100") {
    return renderIghDonationTermPdf(input);
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error("Modelo oficial do termo de doação não encontrado.");
  }

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const src = await PDFDocument.load(templateBytes);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const copied = await doc.copyPages(src, src.getPageIndices());
  for (const page of copied) doc.addPage(page);

  const fontRegular = await doc.embedFont(fs.readFileSync(FONT_REGULAR_PATH), { subset: true });
  const page1 = doc.getPage(0);
  const page2 = doc.getPageCount() > 1 ? doc.getPage(1) : page1;
  const sizeDonataria = 11.3;

  const donor = input.donor;
  const donee = input.donataria;

  if (shouldRedrawDonor(donor)) {
    drawDonorBlock(page1, donor, fontRegular);
  }

  draw(page1, dash(donee.name), fontRegular, sizeDonataria, 116, 506, 400);
  draw(page1, donatariaAddress(donee), fontRegular, sizeDonataria, 140, 490.2, 380);
  draw(page1, dash(donee.contactName), fontRegular, sizeDonataria, 160, 475.9, 360);
  draw(page1, dash(donee.phone), fontRegular, sizeDonataria, 108, 461.7, 400);
  draw(page1, dash(donee.document), fontRegular, sizeDonataria, 118, 447.4, 390);
  draw(page1, dash(donee.city), fontRegular, sizeDonataria, 126, 431.7, 180);
  draw(page1, dash(donee.state), fontRegular, sizeDonataria, 372, 431.7, 140);
  draw(page1, dash(donee.email), fontRegular, sizeDonataria, 120, 416.6, 400);

  paintWhite(page1, 500, 296, 22, 15);
  drawRight(page1, computersQuantity(input), fontRegular, 11.3, 517.3, 299.5);

  paintWhite(page2, 180, 313, 340, 18);
  drawRight(page2, formatPlaceDate(input), fontRegular, 9.8, 510.4, 319.1);

  if (shouldRedrawDonor(donor)) {
    paintWhite(page2, 84, 208, 175, 16);
    drawWrapped(page2, dash(donor.name) || "Doadora", fontRegular, 9.8, 84.9, 213.2, 170, 2);
  }

  drawWrapped(page2, dash(donee.name), fontRegular, 9.8, 280.1, 213.2, 230, 2);

  return doc.save();
}

export { TEMPLATE_PATH };
