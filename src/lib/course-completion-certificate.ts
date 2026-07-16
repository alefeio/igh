import "server-only";

import fs from "fs";
import path from "path";

import fontkit from "@pdf-lib/fontkit";
import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { PDFDocument, rgb } from "pdf-lib";

import {
  BACK_LAYOUT,
  COURSE_CERTIFICATE_CITY_BACK,
  COURSE_CERTIFICATE_CITY_FRONT,
  COURSE_CERTIFICATE_MIN_WORKLOAD_HOURS,
  FRONT_LAYOUT,
} from "@/lib/course-certificate-layout";
import { uploadCertificatePdfToApimages } from "@/lib/holiday-event-certificate";
import { studentCertificatePdfFileName } from "@/lib/course-certificate-pdf-naming";

const TEMPLATE_PATH = path.join(process.cwd(), "assets", "certificates", "course-completion-template.pdf");
const FONT_REGULAR_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf");
const FONT_BOLD_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Bold.ttf");

function formatCertificateDatePtBr(date: Date): string {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const d = date.getUTCDate();
  const m = months[date.getUTCMonth()] ?? "";
  const y = date.getUTCFullYear();
  return `${d} de ${m} de ${y}`;
}

/** Horas exibidas no certificado: nunca abaixo do mínimo institucional. */
export function resolveCertificateWorkloadHours(workloadHours: number | null | undefined): number {
  const n = workloadHours != null && Number.isFinite(workloadHours) ? Number(workloadHours) : 0;
  return Math.max(COURSE_CERTIFICATE_MIN_WORKLOAD_HOURS, n);
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

/** Reduz a fonte até o texto caber em uma única linha na largura máxima. */
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

function drawAlignedText(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    width: number;
    fontSize: number;
    font: PDFFont;
    align: "left" | "center" | "right";
    color?: ReturnType<typeof rgb>;
  },
) {
  const color = opts.color ?? rgb(0.05, 0.05, 0.05);
  const textWidth = opts.font.widthOfTextAtSize(text, opts.fontSize);
  let x = opts.x;
  if (opts.align === "center") x = opts.x + (opts.width - textWidth) / 2;
  else if (opts.align === "right") x = opts.x + opts.width - textWidth;
  page.drawText(text, {
    x: Math.max(opts.x, x),
    y: opts.y,
    size: opts.fontSize,
    font: opts.font,
    color,
  });
}

function drawSingleLineFitted(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    width: number;
    fontSize: number;
    minFontSize: number;
    font: PDFFont;
    align: "left" | "center" | "right";
    color?: ReturnType<typeof rgb>;
  },
) {
  const fontSize = fitFontSizeToWidth(text, opts.font, opts.width, opts.fontSize, opts.minFontSize);
  drawAlignedText(page, text, { ...opts, fontSize });
}

async function embedRemoteImage(pdfDoc: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  if (!url?.startsWith("http")) return null;
  try {
    const imgRes = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") ?? "";
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const isPng = contentType.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50);
    const isJpeg =
      contentType.includes("jpeg") || contentType.includes("jpg") || (bytes[0] === 0xff && bytes[1] === 0xd8);
    if (isPng) return pdfDoc.embedPng(bytes);
    if (isJpeg) return pdfDoc.embedJpg(bytes);
  } catch {
    // ignora falha ao carregar assinatura
  }
  return null;
}

export type CourseCompletionCertificateInput = {
  studentName: string;
  courseName: string;
  workloadHours: number | null;
  moduleTitles: string[];
  teacherName: string;
  teacherSignatureUrl: string | null;
  issuedAt: Date;
};

export async function generateCourseCompletionCertificatePdfBytes(
  input: CourseCompletionCertificateInput,
): Promise<Uint8Array> {
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
  const fontRegularBytes = fs.readFileSync(FONT_REGULAR_PATH);
  const fontBoldBytes = fs.readFileSync(FONT_BOLD_PATH);
  const font = await pdfDoc.embedFont(fontRegularBytes, { subset: true });
  const fontBold = await pdfDoc.embedFont(fontBoldBytes, { subset: true });

  const pages = pdfDoc.getPages();
  if (pages.length < 2) {
    throw new Error("Template de certificado inválido (esperado 2 páginas).");
  }
  const [front, back] = pages;

  const studentName = (input.studentName || "").trim().toUpperCase() || "ALUNO";
  const courseNameUpper = (input.courseName || "").trim().toUpperCase() || "CURSO";
  const courseNameDisplay = (input.courseName || "").trim() || "Curso";
  const hours = String(resolveCertificateWorkloadHours(input.workloadHours));
  const dateLabel = formatCertificateDatePtBr(input.issuedAt);
  const frontDate = `${COURSE_CERTIFICATE_CITY_FRONT}, ${dateLabel}`;
  const backDate = `${COURSE_CERTIFICATE_CITY_BACK}, ${dateLabel}`;
  const teacherName = (input.teacherName || "").trim() || "Professor";

  // --- Frente ---
  drawSingleLineFitted(front, studentName, {
    ...FRONT_LAYOUT.studentName,
    font: fontBold,
  });

  const sentence = `POR CONCLUIR O CURSO DE ${courseNameUpper} COM CARGA HORÁRIA DE ${hours} HORAS`;
  drawSingleLineFitted(front, sentence, {
    ...FRONT_LAYOUT.courseSentence,
    font: fontBold,
  });

  drawAlignedText(front, frontDate, {
    ...FRONT_LAYOUT.locationDate,
    font,
  });

  // --- Verso ---
  drawSingleLineFitted(back, `Curso de ${courseNameDisplay}`, {
    ...BACK_LAYOUT.courseTitle,
    font: fontBold,
  });
  drawAlignedText(back, `Carga Horária: ${hours}h`, {
    ...BACK_LAYOUT.workload,
    font,
  });
  drawAlignedText(back, backDate, {
    ...BACK_LAYOUT.locationDate,
    font,
  });

  let moduleY = BACK_LAYOUT.modules.startY;
  const titles = input.moduleTitles.map((t) => t.trim()).filter(Boolean);
  for (let i = 0; i < titles.length && i < BACK_LAYOUT.modules.maxLines; i++) {
    const line = `${i + 1}. ${titles[i]}`;
    const wrapped = wrapLines(line, fontBold, BACK_LAYOUT.modules.fontSize, BACK_LAYOUT.modules.width);
    for (const part of wrapped) {
      back.drawText(part, {
        x: BACK_LAYOUT.modules.x,
        y: moduleY,
        size: BACK_LAYOUT.modules.fontSize,
        font: fontBold,
        color: rgb(0.05, 0.05, 0.05),
      });
      moduleY -= BACK_LAYOUT.modules.lineHeight;
      if (moduleY < 80) break;
    }
    if (moduleY < 80) break;
  }

  const signatureImage = await embedRemoteImage(pdfDoc, input.teacherSignatureUrl);
  if (signatureImage) {
    const box = BACK_LAYOUT.teacherSignature;
    const dims = signatureImage.scale(1);
    const scale = Math.min(box.width / dims.width, box.height / dims.height);
    const w = dims.width * scale;
    const h = dims.height * scale;
    back.drawImage(signatureImage, {
      x: box.x + (box.width - w) / 2,
      y: box.y,
      width: w,
      height: h,
    });
  }

  drawAlignedText(back, teacherName, {
    ...BACK_LAYOUT.teacherName,
    font: fontBold,
    color: rgb(0.05, 0.35, 0.15),
  });
  drawAlignedText(back, "Professor", {
    ...BACK_LAYOUT.teacherRole,
    font,
  });

  return pdfDoc.save();
}

export async function generateAndUploadCourseCompletionCertificate(params: {
  enrollmentId: string;
  input: CourseCompletionCertificateInput;
}): Promise<{ url: string; publicId: string; fileName: string; pdfBytes: Uint8Array }> {
  const pdfBytes = await generateCourseCompletionCertificatePdfBytes(params.input);
  const used = new Set<string>();
  const fileName = studentCertificatePdfFileName(params.input.studentName, used);
  const uploaded = await uploadCertificatePdfToApimages({ pdfBytes, fileName });
  return { ...uploaded, pdfBytes };
}
