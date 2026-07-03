/**
 * Gera PDF a partir de markdown em docs/.
 * Uso: npx tsx scripts/generate-inventory-pdf.ts [nome-base-sem-extensao]
 * Ex.: npx tsx scripts/generate-inventory-pdf.ts complemento-valuation-cadastro-cursos
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const ROOT = process.cwd();
const baseName = process.argv[2]?.trim() || "levantamento-recursos-cadastro-cursos";
const MD_PATH = join(ROOT, "docs", `${baseName}.md`);
const OUT_PATH = join(ROOT, "docs", `${baseName}.pdf`);

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const LINE_HEIGHT = 13;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function toWinAnsiSafe(text: string): string {
  const replacements: [string, string][] = [
    ["→", "->"],
    ["←", "<-"],
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
    out = out.split(from).join(to);
  }
  return out.replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safe = toWinAnsiSafe(text);
  if (!safe.trim()) return [""];
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function mdToLines(md: string): Array<{ text: string; kind: "h1" | "h2" | "h3" | "body" | "bullet" | "table" | "hr" }> {
  const result: Array<{ text: string; kind: "h1" | "h2" | "h3" | "body" | "bullet" | "table" | "hr" }> = [];
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line === "---") {
      result.push({ text: "", kind: "hr" });
      continue;
    }
    if (line.startsWith("# ")) {
      result.push({ text: line.slice(2).trim(), kind: "h1" });
      continue;
    }
    if (line.startsWith("## ")) {
      result.push({ text: line.slice(3).trim(), kind: "h2" });
      continue;
    }
    if (line.startsWith("### ")) {
      result.push({ text: line.slice(4).trim(), kind: "h3" });
      continue;
    }
    if (line.startsWith("|")) {
      result.push({ text: line.replace(/\|/g, " ").replace(/\s+/g, " ").trim(), kind: "table" });
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      result.push({ text: line.slice(2).trim(), kind: "bullet" });
      continue;
    }
    if (!line.trim()) {
      result.push({ text: "", kind: "body" });
      continue;
    }
    result.push({ text: line.replace(/\*\*/g, "").replace(/`/g, ""), kind: "body" });
  }
  return result;
}

async function main() {
  const md = readFileSync(MD_PATH, "utf8");
  const lines = mdToLines(md);
  const pdf = await PDFDocument.create();
  const title = baseName.includes("complemento")
    ? "Complemento para Valuation - CadastroCursos IGH"
    : "Levantamento de Recursos - CadastroCursos IGH";
  pdf.setTitle(title);
  pdf.setAuthor("CadastroCursos");
  pdf.setSubject("Inventario de funcionalidades do sistema");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.35, 0.35, 0.35);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) newPage();
  };

  for (const item of lines) {
    if (item.kind === "hr") {
      ensureSpace(20);
      y -= 10;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.5,
        color: rgb(0.75, 0.75, 0.75),
      });
      y -= 10;
      continue;
    }

    if (!item.text && item.kind === "body") {
      y -= LINE_HEIGHT * 0.5;
      continue;
    }

    let size = 10;
    let useFont: PDFFont = font;
    let color = black;
    let prefix = "";
    let gapAfter = LINE_HEIGHT;

    switch (item.kind) {
      case "h1":
        size = 16;
        useFont = fontBold;
        gapAfter = LINE_HEIGHT + 4;
        ensureSpace(28);
        y -= 8;
        break;
      case "h2":
        size = 13;
        useFont = fontBold;
        gapAfter = LINE_HEIGHT + 2;
        ensureSpace(22);
        y -= 6;
        break;
      case "h3":
        size = 11;
        useFont = fontBold;
        gapAfter = LINE_HEIGHT;
        ensureSpace(18);
        y -= 4;
        break;
      case "bullet":
        prefix = "- ";
        color = black;
        break;
      case "table":
        size = 8.5;
        color = muted;
        gapAfter = LINE_HEIGHT - 2;
        break;
      default:
        break;
    }

    const display = prefix + item.text;
    const wrapped = wrapLine(display, useFont, size, CONTENT_WIDTH);

    for (const wl of wrapped) {
      ensureSpace(gapAfter);
      page.drawText(wl, { x: MARGIN, y: y - size, size, font: useFont, color });
      y -= gapAfter;
    }
  }

  const bytes = await pdf.save();
  writeFileSync(OUT_PATH, bytes);
  console.log(`PDF gerado: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
