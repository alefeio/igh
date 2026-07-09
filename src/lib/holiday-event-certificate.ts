import "server-only";

import type { PDFImage, PDFPage } from "pdf-lib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getApimagesConfig } from "@/lib/apimages";
import { apimagesUploadHeaders, parseApimagesUploadJson } from "@/lib/apimages-upload";
import { getSiteSettings } from "@/lib/site-data";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 54;
const WATERMARK_OPACITY = 0.08;

/** Converte texto para caracteres compatíveis com WinAnsi (Helvetica no pdf-lib). */
function toWinAnsiSafe(text: string): string {
  const replacements: [string, string][] = [
    ["•", "-"],
    ["–", "-"],
    ["—", "-"],
    ["…", "..."],
  ];
  let out = text;
  for (const [from, to] of replacements) out = out.split(from).join(to);
  // Substitui qualquer outro caractere fora do Latin-1/WinAnsi por espaço
  return out.replace(/[\u0100-\uFFFF]/g, " ");
}

function wrapLines(text: string, maxChars: number): string[] {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return [];
  const out: string[] = [];
  const parts = trimmed.split(/\s+/);
  let line = "";
  for (const w of parts) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxChars) {
      line = next;
      continue;
    }
    if (line) out.push(line);
    line = w;
  }
  if (line) out.push(line);
  return out;
}

function drawWatermark(page: PDFPage, logoImage: PDFImage | null) {
  if (!logoImage) return;
  const dims = logoImage.scale(1);
  const targetW = PAGE_WIDTH * 0.55;
  const ratio = targetW / dims.width;
  const w = dims.width * ratio;
  const h = dims.height * ratio;
  page.drawImage(logoImage, {
    x: (PAGE_WIDTH - w) / 2,
    y: (PAGE_HEIGHT - h) / 2,
    width: w,
    height: h,
    opacity: WATERMARK_OPACITY,
  });
}

function formatOccurrenceDatePtBr(ymd: string): string {
  const d = new Date(ymd + "T12:00:00.000Z");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function durationLabel(start: string | null, end: string | null): string | null {
  const s = start?.trim()?.slice(0, 5) ?? "";
  const e = end?.trim()?.slice(0, 5) ?? "";
  if (!/^\d{2}:\d{2}$/.test(s) || !/^\d{2}:\d{2}$/.test(e)) return null;
  const [sh, sm] = s.split(":").map((x) => parseInt(x, 10));
  const [eh, em] = e.split(":").map((x) => parseInt(x, 10));
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

export async function generateHolidayEventCertificatePdfBytes(params: {
  participantName: string;
  eventName: string;
  occurrenceDate: string;
  eventStartTime: string | null;
  eventEndTime: string | null;
  responsibleTeacherName: string | null;
}) {
  const site = await getSiteSettings();
  const siteName = site?.siteName?.trim() || "Instituto";
  const logoUrl = site?.logoUrl?.trim() || null;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawWatermark(page, logoImage);

  const black = rgb(0, 0, 0);
  const gray = rgb(0.3, 0.3, 0.3);
  const primary = rgb(0.0, 0.4, 0.7);

  // borda
  page.drawRectangle({
    x: MARGIN - 10,
    y: MARGIN - 10,
    width: PAGE_WIDTH - (MARGIN - 10) * 2,
    height: PAGE_HEIGHT - (MARGIN - 10) * 2,
    borderColor: rgb(0.85, 0.9, 0.95),
    borderWidth: 2,
    color: undefined,
  });

  // título
  const title = "CERTIFICADO DE PARTICIPAÇÃO";
  const titleWidth = fontBold.widthOfTextAtSize(title, 18);
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: PAGE_HEIGHT - MARGIN - 40,
    size: 18,
    font: fontBold,
    color: primary,
  });

  const participant = (params.participantName || "").trim() || "Participante";
  const eventName = (params.eventName || "").trim() || "Evento IGH";
  const dateLabel = formatOccurrenceDatePtBr(params.occurrenceDate);
  const timeLabel =
    params.eventStartTime && params.eventEndTime
      ? `${params.eventStartTime.slice(0, 5)} às ${params.eventEndTime.slice(0, 5)}`
      : null;
  const dur = durationLabel(params.eventStartTime, params.eventEndTime);

  const lines = [
    `Certificamos que ${participant} participou do evento ${eventName},`,
    `realizado em ${dateLabel}${timeLabel ? `, das ${timeLabel}` : ""}${dur ? ` (duração: ${dur})` : ""}.`,
  ].flatMap((t) => wrapLines(t, 78));

  let y = PAGE_HEIGHT - MARGIN - 120;
  for (const line of lines) {
    page.drawText(toWinAnsiSafe(line), { x: MARGIN, y, size: 12, font, color: black });
    y -= 20;
  }

  // rodapé / assinatura
  const footerY = MARGIN + 120;
  page.drawLine({
    start: { x: MARGIN, y: footerY },
    end: { x: PAGE_WIDTH - MARGIN, y: footerY },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  page.drawText(toWinAnsiSafe(siteName), { x: MARGIN, y: footerY - 22, size: 10, font, color: gray });

  const teacherName = params.responsibleTeacherName?.trim() || null;
  if (teacherName) {
    const sigLineY = MARGIN + 70;
    page.drawLine({
      start: { x: MARGIN, y: sigLineY },
      end: { x: MARGIN + 250, y: sigLineY },
      thickness: 1,
      color: rgb(0.65, 0.65, 0.65),
    });
    page.drawText(toWinAnsiSafe(teacherName), { x: MARGIN, y: sigLineY - 16, size: 10, font: fontBold, color: black });
    page.drawText("Professor responsável", { x: MARGIN, y: sigLineY - 30, size: 9, font, color: gray });
  }

  return pdfDoc.save();
}

export async function uploadCertificatePdfToApimages(params: {
  pdfBytes: Uint8Array;
  fileName: string;
}): Promise<{ url: string; publicId: string; fileName: string }> {
  const { uploadUrl, apiKey } = getApimagesConfig();
  const blob = new Blob([params.pdfBytes], { type: "application/pdf" });
  const fd = new FormData();
  fd.append("file", blob, params.fileName);

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: apimagesUploadHeaders(apiKey),
    body: fd,
  });
  const uploadJson = await uploadRes.json().catch(() => null);
  const parsed = parseApimagesUploadJson(uploadJson);
  if (!uploadRes.ok || parsed.errorMessage || !parsed.url) {
    throw new Error(parsed.errorMessage ?? "Falha ao enviar certificado.");
  }
  return {
    url: parsed.url,
    publicId: parsed.publicId,
    fileName: params.fileName,
  };
}

