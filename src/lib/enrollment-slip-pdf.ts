/**
 * Comprovante de matrícula para preenchimento manual (atendimento presencial).
 *
 * Espelha os dados que o aluno recebe por e-mail ao ser matriculado
 * (`templateStudentWelcome`): curso, início, dias, horário e local. Aqui os
 * campos ficam em branco para a equipe escrever à mão, e a lista de cursos do
 * ciclo vem do banco para que só apareçam opções realmente ofertadas.
 *
 * Formato: A4 retrato com 4 vias idênticas (grade 2×2, cada via em A6).
 */

import fs from "node:fs";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { formatDaysShortPtBr } from "@/lib/turma-display";

const FONT_REGULAR_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf");
const FONT_BOLD_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Bold.ttf");
const LOGO_PATH = path.join(process.cwd(), "public", "images", "logo.png");

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
/** Folga interna de cada via: mantém o conteúdo longe do corte e da margem da impressora. */
const SLIP_PADDING = 20;
/** Altura das linhas preenchidas à mão. */
const WRITE_ROW = 28;
const NOTE_HEIGHT = 32;

const INK = rgb(0.11, 0.13, 0.17);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.62, 0.65, 0.7);
const BRAND_BLUE = rgb(0.12, 0.25, 0.69);
const NOTE_BG = rgb(0.949, 0.965, 0.996);
const NOTE_BORDER = rgb(0.78, 0.85, 0.95);
const CUT_GUIDE = rgb(0.78, 0.8, 0.83);
const WHITE = rgb(1, 1, 1);

export type EnrollmentSlipCourse = {
  name: string;
  workloadHours: number | null;
};

export type EnrollmentSlipData = {
  cycle: { id: string; cycle: number; year: number };
  courses: EnrollmentSlipCourse[];
  /** Combinações de dias ofertadas no ciclo (ex.: "ter e qui"). Vazio = campo livre. */
  dayOptions: string[];
  /** Preenchido só quando o ciclo inteiro acontece em um único local. */
  defaultLocation: string | null;
  /** Endereço do login sem protocolo, para o aluno digitar no navegador. */
  loginUrl: string;
  /** Contato institucional impresso no rodapé da via. */
  contact: { whatsapp: string | null; siteUrl: string | null };
};

const DAY_ORDER = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function dayComboRank(label: string): number {
  const first = label.split(/[,\s]/)[0]?.toLowerCase() ?? "";
  const index = DAY_ORDER.indexOf(first);
  return index >= 0 ? index : DAY_ORDER.length;
}

/**
 * Cursos e horários realmente ofertados no ciclo (turmas canceladas ficam fora).
 */
export async function loadEnrollmentSlipData(cycleId: string): Promise<EnrollmentSlipData> {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { id: true, cycle: true, year: true },
  });
  if (!cycle) throw new Error("Ciclo não encontrado.");

  const classGroups = await prisma.classGroup.findMany({
    where: { cycleId, status: { not: "CANCELADA" } },
    select: {
      daysOfWeek: true,
      location: true,
      course: { select: { name: true, workloadHours: true } },
      poloLocation: { select: { name: true, address: true } },
    },
  });

  const byCourse = new Map<string, EnrollmentSlipCourse>();
  for (const cg of classGroups) {
    const name = cg.course.name.trim();
    if (!name || byCourse.has(name)) continue;
    byCourse.set(name, { name, workloadHours: cg.course.workloadHours ?? null });
  }
  const courses = [...byCourse.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const dayCombos = new Set<string>();
  for (const cg of classGroups) {
    const label = formatDaysShortPtBr(cg.daysOfWeek);
    if (label && label !== "—") dayCombos.add(label);
  }
  // Muitas combinações não caberiam como opções: nesse caso vira campo livre.
  const dayOptions =
    dayCombos.size > 0 && dayCombos.size <= 3
      ? [...dayCombos].sort((a, b) => dayComboRank(a) - dayComboRank(b) || a.localeCompare(b, "pt-BR"))
      : [];

  // Endereço completo do polo é mais útil ao aluno do que o apelido do local.
  const locations = new Set<string>();
  for (const cg of classGroups) {
    const label = (cg.poloLocation?.address ?? cg.poloLocation?.name ?? cg.location ?? "").trim();
    if (label) locations.add(label);
  }
  const defaultLocation = locations.size === 1 ? [...locations][0]! : null;

  const settings = await prisma.siteSettings
    .findFirst({ select: { publicAppUrl: true, contactWhatsapp: true } })
    .catch(() => null);
  // Mesma precedência dos e-mails: APP_URL e depois a URL pública do admin.
  const baseUrl = (process.env.APP_URL?.trim() || settings?.publicAppUrl?.trim() || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return {
    cycle,
    courses,
    dayOptions,
    defaultLocation,
    loginUrl: baseUrl ? `${baseUrl}/login` : "",
    contact: {
      whatsapp: settings?.contactWhatsapp?.trim() || null,
      siteUrl: baseUrl || null,
    },
  };
}

type Fonts = { regular: PDFFont; bold: PDFFont };

function fitSize(
  text: string,
  font: PDFFont,
  maxWidth: number,
  baseSize: number,
  minSize: number,
): number {
  let size = baseSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.25;
  }
  return size;
}

function clip(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

type FieldCell = {
  label: string;
  /** Fração da largura disponível (a soma deve dar 1). */
  flex: number;
  /** Texto já impresso na linha (ex.: local único do ciclo). */
  prefill?: string;
  /** Opções para marcar com ☐ em vez de escrever. */
  options?: string[];
};

/** Uma linha de campos: rótulo pequeno em cima, espaço de escrita e linha-guia. */
function drawFieldRow(
  page: PDFPage,
  fonts: Fonts,
  cells: FieldCell[],
  opts: { x: number; top: number; width: number; height: number; gap: number },
): number {
  const { x, top, width, height, gap } = opts;
  const totalGap = gap * (cells.length - 1);
  const usable = width - totalGap;
  let cursorX = x;

  for (const cell of cells) {
    const cellWidth = usable * cell.flex;
    page.drawText(cell.label, {
      x: cursorX,
      y: top - 6,
      size: 5.8,
      font: fonts.bold,
      color: MUTED,
    });

    const baseline = top - height + 5;
    if (cell.options?.length) {
      let optX = cursorX;
      const optSize = 7;
      for (const option of cell.options) {
        const box = 6.4;
        page.drawRectangle({
          x: optX,
          y: baseline - 0.8,
          width: box,
          height: box,
          borderColor: LINE,
          borderWidth: 0.7,
        });
        page.drawText(option, {
          x: optX + box + 3,
          y: baseline,
          size: optSize,
          font: fonts.regular,
          color: INK,
        });
        optX += box + 3 + fonts.regular.widthOfTextAtSize(option, optSize) + 10;
      }
    } else if (cell.prefill) {
      const size = fitSize(cell.prefill, fonts.regular, cellWidth - 2, 8, 6);
      page.drawText(cell.prefill, {
        x: cursorX,
        y: baseline,
        size,
        font: fonts.regular,
        color: INK,
      });
    }

    page.drawLine({
      start: { x: cursorX, y: top - height },
      end: { x: cursorX + cellWidth, y: top - height },
      thickness: 0.7,
      color: LINE,
    });
    cursorX += cellWidth + gap;
  }

  return top - height;
}

function drawCourseChecklist(
  page: PDFPage,
  fonts: Fonts,
  courses: EnrollmentSlipCourse[],
  opts: { x: number; top: number; width: number; available: number },
): number {
  const { x, top, width, available } = opts;
  page.drawText("CURSO — MARQUE UMA OPÇÃO", {
    x,
    y: top - 6,
    size: 5.8,
    font: fonts.bold,
    color: MUTED,
  });
  const listTop = top - 12;

  const columns = courses.length > 8 ? 2 : 1;
  const rows = Math.ceil(courses.length / columns);
  const rowHeight = Math.max(8.5, Math.min(11.5, available / Math.max(rows, 1)));
  const columnGap = 10;
  const columnWidth = (width - columnGap * (columns - 1)) / columns;
  const box = Math.min(6.6, rowHeight - 3);

  courses.forEach((course, index) => {
    const column = Math.floor(index / rows);
    const row = index % rows;
    const cellX = x + column * (columnWidth + columnGap);
    const baseline = listTop - row * rowHeight - rowHeight + 3;

    page.drawRectangle({
      x: cellX,
      y: baseline - 0.8,
      width: box,
      height: box,
      borderColor: LINE,
      borderWidth: 0.7,
    });

    const textX = cellX + box + 4;
    const textWidth = columnWidth - (box + 4);
    const suffix = course.workloadHours ? ` (${course.workloadHours}h)` : "";
    const size = fitSize(`${course.name}${suffix}`, fonts.regular, textWidth, 7.4, 5.6);
    page.drawText(clip(`${course.name}${suffix}`, fonts.regular, size, textWidth), {
      x: textX,
      y: baseline,
      size,
      font: fonts.regular,
      color: INK,
    });
  });

  return listTop - rows * rowHeight;
}

function drawSlip(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage | null,
  data: EnrollmentSlipData,
  cell: { x: number; y: number; width: number; height: number },
): void {
  const left = cell.x + SLIP_PADDING;
  const right = cell.x + cell.width - SLIP_PADDING;
  const width = right - left;
  const bottom = cell.y + SLIP_PADDING;
  let y = cell.y + cell.height - SLIP_PADDING;

  // Cabeçalho: logo + instituição.
  let textX = left;
  if (logo) {
    const logoHeight = 20;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    page.drawImage(logo, { x: left, y: y - logoHeight, width: logoWidth, height: logoHeight });
    textX = left + logoWidth + 6;
  }
  page.drawText(BRAND.legalName, {
    x: textX,
    y: y - 9,
    size: fitSize(BRAND.legalName, fonts.bold, right - textX, 9, 6.5),
    font: fonts.bold,
    color: INK,
  });
  page.drawText("Comprovante de matrícula — via do aluno", {
    x: textX,
    y: y - 18,
    size: 6.4,
    font: fonts.regular,
    color: MUTED,
  });
  y -= 26;

  // Faixa do ciclo.
  const bandHeight = 15;
  page.drawRectangle({ x: left, y: y - bandHeight, width, height: bandHeight, color: BRAND_BLUE });
  const bandText = `MATRÍCULA CONFIRMADA · CICLO ${data.cycle.cycle}/${data.cycle.year}`;
  const bandSize = fitSize(bandText, fonts.bold, width - 12, 8, 6);
  page.drawText(bandText, {
    x: left + (width - fonts.bold.widthOfTextAtSize(bandText, bandSize)) / 2,
    y: y - bandHeight + 5,
    size: bandSize,
    font: fonts.bold,
    color: WHITE,
  });
  y -= bandHeight + 10;

  const rowHeight = WRITE_ROW;
  const gap = 10;

  y = drawFieldRow(
    page,
    fonts,
    [
      { label: "NOME DO ALUNO", flex: 0.64 },
      { label: "DATA DA MATRÍCULA", flex: 0.36 },
    ],
    { x: left, top: y, width, height: rowHeight, gap },
  );
  y -= 8;

  // Tudo abaixo da lista de cursos tem altura fixa; a lista fica com a sobra.
  const belowChecklist =
    10 + // respiro após a lista
    (rowHeight + 6) + // dias da semana
    (rowHeight + 6) + // início e horário
    (rowHeight + 8) + // local
    (NOTE_HEIGHT + 8) + // orientações
    rowHeight; // atendente
  const available = Math.max(30, y - bottom - 12 - belowChecklist);

  y = drawCourseChecklist(page, fonts, data.courses, { x: left, top: y, width, available });
  y -= 10;

  y = drawFieldRow(
    page,
    fonts,
    [
      data.dayOptions.length > 0
        ? { label: "DIAS DA SEMANA", flex: 1, options: data.dayOptions }
        : { label: "DIAS DA SEMANA", flex: 1 },
    ],
    { x: left, top: y, width, height: rowHeight, gap },
  );
  y -= 6;

  y = drawFieldRow(
    page,
    fonts,
    [
      { label: "INÍCIO DAS AULAS", flex: 0.46 },
      { label: "HORÁRIO", flex: 0.54 },
    ],
    { x: left, top: y, width, height: rowHeight, gap },
  );
  y -= 6;

  y = drawFieldRow(
    page,
    fonts,
    [
      data.defaultLocation
        ? { label: "LOCAL", flex: 1, prefill: data.defaultLocation }
        : { label: "LOCAL", flex: 1 },
    ],
    { x: left, top: y, width, height: rowHeight, gap },
  );
  y -= 8;

  // Orientações ao aluno.
  page.drawRectangle({
    x: left,
    y: y - NOTE_HEIGHT,
    width,
    height: NOTE_HEIGHT,
    color: NOTE_BG,
    borderColor: NOTE_BORDER,
    borderWidth: 0.7,
  });
  const noteLines = [
    "Apresente este comprovante no primeiro dia de aula. Chegue 10 minutos antes.",
    data.loginUrl
      ? `Aulas, materiais, frequência e certificado em ${data.loginUrl} (entre com seu e-mail).`
      : "Aulas, materiais, frequência e certificado na área do aluno (entre com seu e-mail).",
  ];
  noteLines.forEach((line, index) => {
    const size = fitSize(line, fonts.regular, width - 12, 6.4, 5);
    page.drawText(line, {
      x: left + 6,
      y: y - 12 - index * 10,
      size,
      font: fonts.regular,
      color: INK,
    });
  });
  y -= NOTE_HEIGHT + 8;

  drawFieldRow(page, fonts, [{ label: "ATENDENTE", flex: 0.52 }], {
    x: left,
    top: y,
    width,
    height: rowHeight,
    gap,
  });

  // Contato do instituto, alinhado à direita na mesma faixa do atendente.
  const contactLines = [
    data.contact.whatsapp ? `WhatsApp ${data.contact.whatsapp}` : null,
    data.contact.siteUrl,
  ].filter((line): line is string => Boolean(line));
  if (contactLines.length > 0) {
    const contactWidth = width * 0.44;
    page.drawText("CONTATO DO INSTITUTO", {
      x: right - fonts.bold.widthOfTextAtSize("CONTATO DO INSTITUTO", 5.8),
      y: y - 6,
      size: 5.8,
      font: fonts.bold,
      color: MUTED,
    });
    contactLines.forEach((line, index) => {
      const size = fitSize(line, fonts.regular, contactWidth, 7, 5.4);
      page.drawText(line, {
        x: right - fonts.regular.widthOfTextAtSize(line, size),
        y: y - 16 - index * 9.5,
        size,
        font: fonts.regular,
        color: INK,
      });
    });
  }
}

/** Linhas-guia de corte no centro da folha (2×2). */
function drawCutGuides(page: PDFPage): void {
  page.drawLine({
    start: { x: A4_WIDTH / 2, y: 0 },
    end: { x: A4_WIDTH / 2, y: A4_HEIGHT },
    thickness: 0.5,
    color: CUT_GUIDE,
    dashArray: [3, 3],
  });
  page.drawLine({
    start: { x: 0, y: A4_HEIGHT / 2 },
    end: { x: A4_WIDTH, y: A4_HEIGHT / 2 },
    thickness: 0.5,
    color: CUT_GUIDE,
    dashArray: [3, 3],
  });
}

/**
 * Gera o PDF com 4 comprovantes idênticos por folha A4.
 * `pages` permite sair da impressora já com várias folhas prontas.
 */
export async function buildEnrollmentSlipsPdf(
  data: EnrollmentSlipData,
  options?: { pages?: number },
): Promise<Uint8Array> {
  const pages = Math.min(Math.max(Math.trunc(options?.pages ?? 1), 1), 25);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    regular: fs.existsSync(FONT_REGULAR_PATH)
      ? await doc.embedFont(fs.readFileSync(FONT_REGULAR_PATH), { subset: true })
      : await doc.embedFont(StandardFonts.Helvetica),
    bold: fs.existsSync(FONT_BOLD_PATH)
      ? await doc.embedFont(fs.readFileSync(FONT_BOLD_PATH), { subset: true })
      : await doc.embedFont(StandardFonts.HelveticaBold),
  };

  let logo: PDFImage | null = null;
  if (fs.existsSync(LOGO_PATH)) {
    try {
      logo = await doc.embedPng(fs.readFileSync(LOGO_PATH));
    } catch {
      logo = null;
    }
  }

  doc.setTitle(`Comprovantes de matrícula — Ciclo ${data.cycle.cycle}/${data.cycle.year}`);
  doc.setSubject("Comprovante de matrícula para preenchimento manual (4 vias por folha A4)");

  const cellWidth = A4_WIDTH / 2;
  const cellHeight = A4_HEIGHT / 2;

  for (let p = 0; p < pages; p++) {
    const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
    drawCutGuides(page);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        drawSlip(page, fonts, logo, data, {
          x: col * cellWidth,
          y: A4_HEIGHT - (row + 1) * cellHeight,
          width: cellWidth,
          height: cellHeight,
        });
      }
    }
  }

  return doc.save();
}
