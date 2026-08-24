import fs from "node:fs";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { BRAND } from "@/lib/brand";
import { EXECUTIVE_METHODOLOGY_LABEL } from "@/lib/diretor/catalog/definitions";
import { pdfBarWidth, resolvePdfBar } from "@/lib/diretor/reports/pdf-bars";
import { formatDataConsideredUntil, formatFiltersHuman, formatUpdatedAtFriendly, friendlyDataStamp, qualityStatusLabel } from "@/lib/diretor/ui-labels";

type Kpi = {
  label: string;
  value: unknown;
  quality?: string;
  unit?: string;
  currentValue?: number | null;
  targetValue?: number | null;
  percentage?: number | null;
  formattedValue?: string;
};
type Alert = { title?: string; fact?: string; suggestedDecision?: string; severity?: string };
type QualityItem = { domain?: string; status?: string; note?: string };

type Report = {
  title: string;
  institution?: string;
  brand?: string;
  period?: unknown;
  periodLabel?: string;
  generatedAt?: string;
  dataAsOf?: string;
  formulaVersion?: string;
  indicators?: { kpis?: Kpi[]; alerts?: Alert[] };
  alerts?: Alert[];
  quality?: QualityItem[] | unknown;
  caveats?: string[];
  disclaimer?: string;
};

const NAVY = rgb(0.05, 0.2, 0.38);
const AMBER = rgb(0.72, 0.45, 0.1);
const MUTED = rgb(0.25, 0.28, 0.32);

function asText(v: unknown): string {
  if (v == null) return "—";
  return String(v);
}

function looksLikeMoney(k: Kpi): boolean {
  return typeof k.value === "string" && String(k.value).includes("R$");
}

export async function buildDirectorPdf(report: Report): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regularBytes = fs.readFileSync(path.join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf"));
  const boldBytes = fs.readFileSync(path.join(process.cwd(), "assets/fonts/NotoSans-Bold.ttf"));
  const font = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });

  let logo = null as Awaited<ReturnType<PDFDocument["embedPng"]>> | null;
  try {
    const logoPath = path.join(process.cwd(), "public/images/logo.png");
    if (fs.existsSync(logoPath)) logo = await doc.embedPng(fs.readFileSync(logoPath));
  } catch {
    logo = null;
  }

  const pages: PDFPage[] = [];
  let page = doc.addPage([595, 842]);
  pages.push(page);
  let y = 780;

  const footer = () => {
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      p.drawLine({ start: { x: 40, y: 42 }, end: { x: 555, y: 42 }, thickness: 0.5, color: rgb(0.8, 0.82, 0.85) });
      p.drawText(`${BRAND.shortName} — ${BRAND.legalName}`, { x: 40, y: 28, size: 8, font, color: MUTED });
      p.drawText(`${EXECUTIVE_METHODOLOGY_LABEL}  ·  pág. ${i + 1} de ${pages.length}`, {
        x: 330,
        y: 28,
        size: 8,
        font,
        color: MUTED,
      });
    }
  };

  const ensure = (need: number) => {
    if (y - need < 56) {
      page = doc.addPage([595, 842]);
      pages.push(page);
      y = 800;
    }
  };

  const draw = (s: string, size = 10, b = false, color = MUTED) => {
    const lines = wrap(s, b ? bold : font, size, 500);
    for (const line of lines) {
      ensure(size + 8);
      page.drawText(line, { x: 40, y, size, font: b ? bold : font, color });
      y -= size + 5;
    }
  };

  page.drawRectangle({ x: 0, y: 802, width: 595, height: 40, color: NAVY });
  if (logo) {
    const w = 28;
    const h = (logo.height / logo.width) * w;
    page.drawImage(logo, { x: 40, y: 808, width: w, height: h });
  }
  page.drawText(`${BRAND.shortName}  ·  ${BRAND.legalName}`, {
    x: logo ? 78 : 40,
    y: 816,
    size: 11,
    font: bold,
    color: rgb(1, 1, 1),
  });

  draw(report.title, 18, true, NAVY);
  draw(`Filtros: ${report.periodLabel || formatFiltersHuman(report.period)}`, 9);
  if (report.dataAsOf && report.generatedAt && report.dataAsOf !== report.generatedAt) {
    draw(formatDataConsideredUntil(report.dataAsOf), 9);
    draw(formatUpdatedAtFriendly(report.generatedAt).replace("Atualizado em", "Gerado em"), 9);
  } else {
    draw(friendlyDataStamp(report.dataAsOf ?? "", report.generatedAt), 9);
  }
  y -= 6;

  draw("Síntese executiva", 13, true, NAVY);
  draw(
    "Este relatório consolida os mesmos indicadores da área da Direção. Não contém dados pessoais nominais. Movimentação paga não é saldo bancário.",
    9,
  );
  y -= 4;

  const kpis = (report.indicators?.kpis ?? []).slice(0, 6);
  draw("Indicadores", 13, true, NAVY);
  for (const k of kpis) {
    const valueLines = wrap(asText(k.formattedValue ?? k.value), bold, 11, 500);
    const qLabel = k.quality === "partial" ? "Leitura parcial" : null;
    const boxH = 22 + valueLines.length * 13 + (qLabel ? 12 : 0);
    ensure(boxH + 8);
    page.drawRectangle({ x: 40, y: y - boxH + 8, width: 515, height: boxH, color: rgb(0.95, 0.96, 0.98) });
    page.drawText(k.label.slice(0, 90), { x: 48, y: y - 2, size: 8, font, color: MUTED });
    y -= 16;
    for (const line of valueLines) {
      page.drawText(line, { x: 48, y, size: 11, font: bold, color: NAVY });
      y -= 13;
    }
    if (qLabel) {
      page.drawText(qLabel, { x: 48, y, size: 8, font, color: AMBER });
      y -= 12;
    }
    y -= 8;
  }

  const countBars = kpis
    .filter((k) => k.unit !== "%" && !looksLikeMoney(k) && k.percentage == null)
    .map((k) => resolvePdfBar(k, "count"))
    .filter((b) => b.kind === "count" && b.plot != null);
  const percentBars = kpis
    .filter((k) => k.unit === "%" || k.percentage != null)
    .map((k) => resolvePdfBar(k, "percent"))
    .filter((b) => b.kind === "percent");

  if (countBars.length >= 2) {
    y -= 4;
    draw("Pessoas e volumes (mesma unidade: quantidade)", 11, true, NAVY);
    y = drawTypedBars(page, countBars, 40, y, font, "count");
  }
  if (percentBars.length >= 1) {
    const need = 28 + percentBars.length * 16;
    ensure(need);
    draw("Percentuais (eixo de 0 a 100)", 11, true, NAVY);
    y = drawTypedBars(page, percentBars, 40, y, font, "percent");
  }

  const allAlerts = report.alerts ?? report.indicators?.alerts ?? [];
  const decisionAlerts = allAlerts.filter((a) => a.severity !== "info").slice(0, 6);
  const infoAlerts = allAlerts.filter((a) => a.severity === "info").slice(0, 4);
  ensure(40);
  draw("Alertas e decisões sugeridas", 13, true, NAVY);
  if (decisionAlerts.length === 0) draw("Nenhum alerta decisório neste recorte.");
  for (const a of decisionAlerts) {
    draw(asText(a.title), 10, true, AMBER);
    draw(asText(a.fact), 9);
    if (a.suggestedDecision) draw(`Decisão sugerida: ${a.suggestedDecision}`, 9);
    y -= 4;
  }
  if (infoAlerts.length > 0) {
    draw("Acompanhamentos", 12, true, NAVY);
    for (const a of infoAlerts) {
      draw(asText(a.title), 10, true, MUTED);
      draw(asText(a.fact), 9);
      y -= 2;
    }
  }

  const finKpi = kpis.find((k) => /líquid|pago|financeiro|receb/i.test(k.label));
  if (finKpi || (report.disclaimer && /saldo|banc/i.test(report.disclaimer))) {
    ensure(40);
    page.drawRectangle({ x: 40, y: y - 28, width: 515, height: 36, color: rgb(1, 0.96, 0.9) });
    y -= 8;
    draw("Ressalva financeira: valores pagos não representam saldo, caixa nem disponibilidade bancária.", 8, true, AMBER);
    y -= 16;
  }

  const quality = Array.isArray(report.quality) ? report.quality : [];
  const caveats = report.caveats ?? [];
  const qualityTexts = [
    "Qualidade dos dados",
    quality.length === 0 ? "Qualidade sem apontamentos." : "",
    ...quality.map(
      (q) => `${humanDomain(q.domain)} — ${qualityStatusLabel(q.status ?? "ok")}${q.note ? `: ${q.note}` : ""}`,
    ),
    ...caveats.map((c) => `• ${c}`),
    `Dados técnicos: versão das fórmulas ${asText(report.formulaVersion)}`,
  ].filter(Boolean);
  const qualityLineCount = qualityTexts.reduce((n, t, i) => n + wrap(t, i === 0 ? bold : font, i === 0 ? 13 : 9, 500).length, 0);
  const qualityNeed = qualityLineCount * 16 + 8;
  if (y - qualityNeed < 56) {
    page = doc.addPage([595, 842]);
    pages.push(page);
    y = 800;
  }
  for (let i = 0; i < qualityTexts.length; i++) {
    const size = i === 0 ? 13 : 9;
    const isTitle = i === 0;
    const lines = wrap(qualityTexts[i], isTitle ? bold : font, size, 500);
    for (const line of lines) {
      page.drawText(line, {
        x: 40,
        y,
        size,
        font: isTitle ? bold : font,
        color: isTitle ? NAVY : MUTED,
      });
      y -= size + 5;
    }
  }

  footer();
  return doc.save();
}

function humanDomain(d?: string): string {
  const map: Record<string, string> = {
    academic: "Acadêmico",
    offer: "Oferta",
    social: "Impacto Social",
    financial: "Financeiro",
    administrative: "Administrativo",
    projects: "Projetos",
    overview: "Visão Geral",
  };
  return map[d ?? ""] ?? d ?? "Tema";
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawTypedBars(
  page: PDFPage,
  items: Array<{ label: string; plot: number | null; display: string }>,
  x: number,
  top: number,
  font: PDFFont,
  axis: "percent" | "count",
): number {
  const max = axis === "percent" ? 100 : Math.max(...items.map((i) => i.plot ?? 0), 1);
  let y = top;
  for (const it of items.slice(0, 4)) {
    const w = pdfBarWidth(it.plot, max, 280);
    if (w != null && w > 0) {
      page.drawRectangle({ x, y: y - 10, width: w, height: 10, color: rgb(0.12, 0.35, 0.55) });
    }
    page.drawText(it.label.slice(0, 36), { x, y: y + 2, size: 7, font, color: MUTED });
    const valueLines = wrap(it.display, font, 8, 220);
    let ty = y - 9;
    for (const line of valueLines.slice(0, 3)) {
      page.drawText(line, { x: x + 290, y: ty, size: 8, font, color: MUTED });
      ty -= 10;
    }
    y -= 16 + Math.max(0, valueLines.length - 1) * 10;
  }
  return y;
}
