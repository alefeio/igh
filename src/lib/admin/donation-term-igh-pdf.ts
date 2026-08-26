import "server-only";

import fs from "fs";
import path from "path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import { DEFAULT_DONATION_KIT, expandDonationKitItems } from "@/lib/donation-kits";
import { prisma } from "@/lib/prisma";

export type IghDonationTermInput = {
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
};

const FONT_REGULAR_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf");
const FONT_BOLD_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Bold.ttf");
const LOGO_SITE_FALLBACK = path.join(process.cwd(), "public", "images", "logo.png");
const LOGO_IGH_FALLBACK = path.join(process.cwd(), "assets", "gerencia", "termo-doacao", "logo-igh.png");
const LOGO_CPI = path.join(process.cwd(), "public", "images", "logo_CPI.png");
const LOGO_BRASIL = path.join(process.cwd(), "public", "images", "logo_Governo.png");

/** Altura alvo das logomarcas no rodapé (pt). */
const LOGO_FOOTER_HEIGHT = 64;
const LOGO_FOOTER_MAX_WIDTH = 200;
const LOGO_FOOTER_Y = 20;

const BLACK = rgb(0, 0, 0);
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

const ITEM_LABEL: Record<string, string> = {
  "cabo de força": "Cabos Força",
  "cabos força": "Cabos Força",
  "cabo de video": "Cabo de Vídeo",
  "cabo de vídeo": "Cabo de Vídeo",
};

function dash(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function asDate(value: Date | string | null | undefined): Date {
  if (!value) return new Date();
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
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

function itemLabel(name: string): string {
  const key = name.trim().toLowerCase();
  return ITEM_LABEL[key] ?? name.trim();
}

function qtyText(n: number): string {
  if (n >= 100) return String(n);
  return String(n).padStart(2, "0");
}

function equipmentRows(input: IghDonationTermInput): Array<{ name: string; qty: string }> {
  const items = input.items?.filter((i) => i.name.trim() && i.quantity > 0) ?? [];
  if (items.length > 0) {
    return items.map((i) => ({ name: itemLabel(i.name), qty: qtyText(i.quantity) }));
  }
  const kits = input.kitsCount && input.kitsCount > 0 ? input.kitsCount : 0;
  if (kits > 0) {
    return expandDonationKitItems(kits, DEFAULT_DONATION_KIT).map((i) => ({
      name: itemLabel(i.name),
      qty: qtyText(i.quantity),
    }));
  }
  return DEFAULT_DONATION_KIT.map((c) => ({ name: itemLabel(c.name), qty: "" }));
}

function doneeAddress(d: IghDonationTermInput["donataria"]): string {
  return [d.street, d.number, d.complement, d.neighborhood].filter(Boolean).join(", ");
}

function zoneMark(zone: string | null | undefined): string {
  const z = (zone ?? "").toUpperCase();
  if (z === "RURAL") return "( ) Urbana  (X) Rural";
  if (z === "URBANA") return "(X) Urbana  ( ) Rural";
  return "( ) Urbana  ( ) Rural";
}

function ighDate(input: IghDonationTermInput): string {
  const custom = input.placeDateText?.trim();
  if (custom) return custom.replace(/\.$/, "");
  const d = asDate(input.donatedAt);
  const city = dash(input.donor.city) || dash(input.donataria.city) || "Belém";
  return `${city}, ${d.getUTCDate()} de ${MONTHS_PT[d.getUTCMonth()] ?? ""} de ${d.getUTCFullYear()}`;
}

type Cell = { text: string; width: number; align?: "left" | "center" };

function drawRow(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  x: number,
  top: number,
  height: number,
  cells: Cell[],
  opts?: { header?: boolean; size?: number },
) {
  const size = opts?.size ?? 9;
  const use = opts?.header ? bold : font;
  let cx = x;
  for (const cell of cells) {
    page.drawRectangle({
      x: cx,
      y: top - height,
      width: cell.width,
      height,
      borderColor: BLACK,
      borderWidth: 0.8,
    });
    const pad = 3;
    const maxW = cell.width - pad * 2;
    const lines = wrapLines(cell.text, use, size, maxW);
    const lineH = size + 1.5;
    let ty = top - pad - size;
    for (const line of lines) {
      let tx = cx + pad;
      if (cell.align === "center") {
        tx = cx + (cell.width - use.widthOfTextAtSize(line, size)) / 2;
      }
      page.drawText(line, { x: tx, y: ty, size, font: use, color: BLACK });
      ty -= lineH;
    }
    cx += cell.width;
  }
}

function rowHeight(font: PDFFont, cells: Cell[], size: number, minH: number): number {
  let lines = 1;
  for (const cell of cells) {
    lines = Math.max(lines, wrapLines(cell.text, font, size, cell.width - 6).length);
  }
  return Math.max(minH, lines * (size + 1.5) + 6);
}

async function embedImageBytes(doc: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  try {
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (isPng) return await doc.embedPng(bytes);
    if (isJpeg) return await doc.embedJpg(bytes);
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * PNG com alpha no pdf-lib às vezes cai como preto. Achata sobre branco
 * para o rodapé do termo (papel branco) preservar texto preto e cores.
 */
async function flattenPngOnWhite(filePath: string): Promise<Uint8Array> {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const img = await loadImage(filePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);
  return new Uint8Array(canvas.toBuffer("image/png"));
}

function resolveSiteLogoUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const p = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${p}`;
}

async function embedSiteLogo(doc: PDFDocument): Promise<PDFImage> {
  try {
    const settings = await prisma.siteSettings.findFirst({
      select: { logoUrl: true },
    });
    const url = resolveSiteLogoUrl(settings?.logoUrl);
    if (url) {
      const imgRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (imgRes.ok) {
        const bytes = new Uint8Array(await imgRes.arrayBuffer());
        const embedded = await embedImageBytes(doc, bytes);
        if (embedded) return embedded;
      }
    }
  } catch {
    /* fallback abaixo */
  }
  const fallbackPath = fs.existsSync(LOGO_SITE_FALLBACK)
    ? LOGO_SITE_FALLBACK
    : LOGO_IGH_FALLBACK;
  return embedLocalImage(doc, fallbackPath);
}

async function embedLocalImage(doc: PDFDocument, filePath: string): Promise<PDFImage> {
  const bytes = new Uint8Array(fs.readFileSync(filePath));
  const embedded = await embedImageBytes(doc, bytes);
  if (!embedded) throw new Error(`Falha ao embutir imagem: ${filePath}`);
  return embedded;
}

async function embedFooterLogo(doc: PDFDocument, filePath: string): Promise<PDFImage> {
  try {
    const flat = await flattenPngOnWhite(filePath);
    const embedded = await embedImageBytes(doc, flat);
    if (embedded) return embedded;
  } catch {
    /* tenta embutir o arquivo cru */
  }
  return embedLocalImage(doc, filePath);
}

async function embedLogos(doc: PDFDocument): Promise<{ site: PDFImage; cpi: PDFImage; brasil: PDFImage }> {
  return {
    site: await embedSiteLogo(doc),
    cpi: await embedFooterLogo(doc, LOGO_CPI),
    brasil: await embedFooterLogo(doc, LOGO_BRASIL),
  };
}

function logoDrawSize(img: PDFImage): { width: number; height: number } {
  let height = LOGO_FOOTER_HEIGHT;
  let width = (img.width / img.height) * height;
  if (width > LOGO_FOOTER_MAX_WIDTH) {
    width = LOGO_FOOTER_MAX_WIDTH;
    height = (img.height / img.width) * width;
  }
  return { width, height };
}

function drawLogos(
  page: PDFPage,
  logos: { site: PDFImage; cpi: PDFImage; brasil: PDFImage },
  margin: number,
  pageWidth: number,
) {
  const site = logoDrawSize(logos.site);
  const cpi = logoDrawSize(logos.cpi);
  const brasil = logoDrawSize(logos.brasil);
  const y = LOGO_FOOTER_Y;
  page.drawImage(logos.site, {
    x: margin,
    y: y + (LOGO_FOOTER_HEIGHT - site.height) / 2,
    width: site.width,
    height: site.height,
  });
  page.drawImage(logos.cpi, {
    x: (pageWidth - cpi.width) / 2,
    y: y + (LOGO_FOOTER_HEIGHT - cpi.height) / 2,
    width: cpi.width,
    height: cpi.height,
  });
  page.drawImage(logos.brasil, {
    x: pageWidth - margin - brasil.width,
    y: y + (LOGO_FOOTER_HEIGHT - brasil.height) / 2,
    width: brasil.width,
    height: brasil.height,
  });
}

function drawWrappedPara(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  top: number,
  maxWidth: number,
  lineGap = 2,
): number {
  const lines = wrapLines(text, font, size, maxWidth);
  let y = top;
  for (const line of lines) {
    page.drawText(line, { x, y: y - size, size, font, color: BLACK });
    y -= size + lineGap;
  }
  return y;
}

/**
 * Termo IGH: tabelas DOADORA/DONATÁRIA, OBJETO (Equipamentos | Qtd) e logos IGH / CPI / Brasil.
 * Não usa o PDF-base da INAC.
 */
export async function renderIghDonationTermPdf(input: IghDonationTermInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = fs.existsSync(FONT_REGULAR_PATH)
    ? await doc.embedFont(fs.readFileSync(FONT_REGULAR_PATH), { subset: true })
    : await doc.embedFont(StandardFonts.Helvetica);
  const bold = fs.existsSync(FONT_BOLD_PATH)
    ? await doc.embedFont(fs.readFileSync(FONT_BOLD_PATH), { subset: true })
    : await doc.embedFont(StandardFonts.HelveticaBold);
  const logos = await embedLogos(doc);

  const page1 = doc.addPage([595.28, 841.89]);
  const page2 = doc.addPage([595.28, 841.89]);
  const margin = 36;
  const tableW = page1.getWidth() - margin * 2;
  const size = 9;

  drawLogos(page1, logos, margin, page1.getWidth());
  drawLogos(page2, logos, margin, page2.getWidth());

  let y = page1.getHeight() - 28;
  const title = "TERMO DE DOAÇÃO DE EQUIPAMENTOS";
  const titleH = 22;
  page1.drawRectangle({
    x: margin,
    y: y - titleH,
    width: tableW,
    height: titleH,
    borderColor: BLACK,
    borderWidth: 1,
  });
  const tw = bold.widthOfTextAtSize(title, 12);
  page1.drawText(title, {
    x: margin + (tableW - tw) / 2,
    y: y - 16,
    size: 12,
    font: bold,
    color: BLACK,
  });
  y -= titleH + 10;

  page1.drawText("DOADORA:", { x: margin, y: y - 11, size: 11, font: bold, color: BLACK });
  y -= 16;

  const donor = input.donor;
  const donorRows: Cell[][] = [
    [{ text: `Nome: ${dash(donor.name)}`, width: tableW }],
    [{ text: `CNPJ: ${dash(donor.document)}`, width: tableW }],
    [{ text: `Endereço: ${dash(donor.address)}`, width: tableW }],
    [
      { text: `Cidade: ${dash(donor.city)}`, width: tableW * 0.42 },
      { text: `Estado: ${dash(donor.state)}`, width: tableW * 0.22 },
      { text: `CEP: ${dash(donor.cep)}`, width: tableW * 0.36 },
    ],
    [{ text: `Responsável Legal: ${dash(donor.representativeName)}`, width: tableW }],
    [
      { text: `Cargo: ${dash(donor.representativeRole)}`, width: tableW * 0.55 },
      { text: `CPF: ${dash(donor.representativeCpf)}`, width: tableW * 0.45 },
    ],
    [
      { text: `TEL: ${dash(donor.phone)}`, width: tableW * 0.45 },
      { text: `Email: ${dash(donor.email)}`, width: tableW * 0.55 },
    ],
  ];
  for (const cells of donorRows) {
    const h = rowHeight(regular, cells, size, 16);
    drawRow(page1, regular, bold, margin, y, h, cells, { size });
    y -= h;
  }

  y -= 12;
  page1.drawText("DONATÁRIA", { x: margin, y: y - 11, size: 11, font: bold, color: BLACK });
  y -= 16;

  const donee = input.donataria;
  const doneeRows: Cell[][] = [
    [{ text: `Instituição: ${dash(donee.name)}`, width: tableW }],
    [{ text: `CNPJ: ${dash(donee.document)}`, width: tableW }],
    [{ text: `Endereço: ${doneeAddress(donee)}`, width: tableW }],
    [
      { text: `Cidade/Município: ${dash(donee.city)}`, width: tableW * 0.62 },
      { text: `Estado: ${dash(donee.state)}`, width: tableW * 0.38 },
    ],
    [
      { text: `CEP: ${dash(donee.cep)}`, width: tableW * 0.42 },
      { text: `Zona: ${zoneMark(donee.zone)}`, width: tableW * 0.58 },
    ],
    [{ text: `Responsável: ${dash(donee.contactName)}`, width: tableW }],
    [{ text: `Telefone: ${dash(donee.phone)}`, width: tableW }],
    [{ text: `E-mail: ${dash(donee.email)}`, width: tableW }],
  ];
  for (const cells of doneeRows) {
    const h = rowHeight(regular, cells, size, 16);
    drawRow(page1, regular, bold, margin, y, h, cells, { size });
    y -= h;
  }

  y -= 12;
  page1.drawText("OBJETO", { x: margin, y: y - 11, size: 11, font: bold, color: BLACK });
  page1.drawLine({
    start: { x: margin, y: y - 13 },
    end: { x: margin + bold.widthOfTextAtSize("OBJETO", 11), y: y - 13 },
    thickness: 0.8,
    color: BLACK,
  });
  y -= 16;

  const objText =
    "O objeto do presente TERMO é a DOAÇÃO, sem nenhum encargo, à DONATÁRIA do(s) seguinte(s) equipamento(s):";
  const objH = rowHeight(regular, [{ text: objText, width: tableW }], size, 20);
  drawRow(page1, regular, bold, margin, y, objH, [{ text: objText, width: tableW }], { size });
  y -= objH;

  const eqW = tableW * 0.78;
  const qW = tableW * 0.22;
  const headerCells: Cell[] = [
    { text: "Equipamentos", width: eqW, align: "center" },
    { text: "Qtd", width: qW, align: "center" },
  ];
  drawRow(page1, regular, bold, margin, y, 16, headerCells, { header: true, size: 10 });
  y -= 16;
  for (const row of equipmentRows(input)) {
    const cells: Cell[] = [
      { text: row.name, width: eqW, align: "center" },
      { text: row.qty, width: qW, align: "center" },
    ];
    drawRow(page1, regular, bold, margin, y, 16, cells, { size: 10 });
    y -= 16;
  }

  y -= 10;
  const obs =
    "OBS: Os termos serão contabilizados somente preenchimento correto, com os dados devidamente completos e legíveis, sem exceção.";
  const obsW = bold.widthOfTextAtSize(obs, 8);
  const obsX = obsW > tableW ? margin : margin + (tableW - Math.min(obsW, tableW)) / 2;
  y = drawWrappedPara(page1, obs, bold, 8, obsX, y, tableW);

  // Página 2 — ACORDO
  let y2 = page2.getHeight() - 40;
  const acordo = "ACORDO";
  page2.drawText(acordo, {
    x: (page2.getWidth() - bold.widthOfTextAtSize(acordo, 13)) / 2,
    y: y2 - 13,
    size: 13,
    font: bold,
    color: BLACK,
  });
  y2 -= 28;

  const acordoBody =
    "Pelo presente instrumento particular e na melhor forma de direito, as partes, anteriormente citadas e devidamente qualificadas, resolvem celebrar o presente TERMO DE DOAÇÃO, onde o CRC IGH, na qualidade de DOADORA, declara que, de acordo com as diretrizes do Programa Computadores para Inclusão do Governo Federal, assinado e publicado no D.O.U. recondicionou os bens de informática descritos e caracterizados no Anexo I, parte integrante deste TERMO, e que, por autorização expressa da Coordenação-Geral de Inclusão Digital do MCOM, transfere a propriedade desses bens, sem quaisquer encargos, em regime de DOAÇÃO.";
  y2 = drawWrappedPara(page2, acordoBody, regular, 9.5, margin, y2, tableW, 3);

  y2 -= 10;
  page2.drawText("São obrigações da Donatária:", {
    x: margin,
    y: y2 - 10,
    size: 10,
    font: bold,
    color: BLACK,
  });
  y2 -= 16;

  const duties = [
    "a) Utilizar todos os bens doados exclusivamente na realização dos objetivos sociais propostos ao Programa Computadores para Inclusão, e de acordo com as diretrizes de Inclusão Digital normatizadas pelo MCOM;",
    "b) Adequar a infraestrutura necessária ao funcionamento pleno dos equipamentos, tais como capacidade elétrica, interligação dos computadores em rede, mobiliário, iluminação e ventilação adequada;",
    "c) Manter os equipamentos conectados à Internet;",
    "d) Permitir ao público uso livre dos equipamentos, independentemente de cursos ou outras atividades programadas;",
    "e) Garantir acesso a todo cidadão, ou pelo menos àqueles da comunidade do entorno do espaço;",
    "f) Realizar a manutenção do local, incluindo limpeza, segurança e custeio;",
    "g) Manter recursos humanos dedicados a orientar o público no uso dos computadores;",
    "h) Promover a acessibilidade física e o atendimento a pessoas com necessidades especiais;",
    "i) Não cobrar da comunidade o acesso à internet;",
  ];
  for (const d of duties) {
    y2 = drawWrappedPara(page2, d, regular, 9, margin, y2, tableW, 2.2);
    y2 -= 4;
  }

  y2 -= 6;
  y2 = drawWrappedPara(
    page2,
    "O não cumprimento dessas obrigações volve os bens doados à Entidade Doadora, para que possa doá-los a outra entidade, ficando, assim, autorizada a fiscalização pelo Ministério das Comunicações.",
    regular,
    9,
    margin,
    y2,
    tableW,
    2.5,
  );

  y2 -= 28;
  const date = ighDate(input);
  const dateW = regular.widthOfTextAtSize(date, 10);
  page2.drawText(date, {
    x: page2.getWidth() - margin - dateW,
    y: y2,
    size: 10,
    font: regular,
    color: BLACK,
  });

  y2 -= 48;
  const colW = tableW / 2;
  page2.drawLine({
    start: { x: margin + 16, y: y2 },
    end: { x: margin + colW - 16, y: y2 },
    thickness: 0.8,
    color: BLACK,
  });
  page2.drawLine({
    start: { x: margin + colW + 16, y: y2 },
    end: { x: margin + tableW - 16, y: y2 },
    thickness: 0.8,
    color: BLACK,
  });
  y2 -= 14;
  const leftName = dash(donor.name) || "INSTITUTO GUSTAVO HESSEL";
  const rightName = dash(donee.name);
  const leftLines = wrapLines(leftName, regular, 8, colW - 24);
  const rightLines = wrapLines(rightName, regular, 8, colW - 24);
  leftLines.forEach((line, i) => {
    const w = regular.widthOfTextAtSize(line, 8);
    page2.drawText(line, {
      x: margin + (colW - w) / 2,
      y: y2 - i * 11,
      size: 8,
      font: regular,
      color: BLACK,
    });
  });
  rightLines.forEach((line, i) => {
    const w = regular.widthOfTextAtSize(line, 8);
    page2.drawText(line, {
      x: margin + colW + (colW - w) / 2,
      y: y2 - i * 11,
      size: 8,
      font: regular,
      color: BLACK,
    });
  });

  return doc.save();
}

export function isIghDonationTemplate(title?: string | null): boolean {
  return /\(IGH\)/i.test(title ?? "");
}
