import fs from "node:fs";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { BRAND } from "@/lib/brand";
import { formatFiltersHuman, qualityStatusLabel } from "@/lib/diretor/ui-labels";

type Kpi = { label: string; value: unknown; quality?: string; unit?: string };
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

function looksLikePercent(k: Kpi): boolean {
  if (k.unit === "%") return true;
  if (typeof k.value === "number" && k.value <= 100 && /ocupa|frequ|conclus|meta|%/i.test(k.label)) return true;
  return typeof k.value === "string" && String(k.value).includes("%");
}

function looksLikeMoney(k: Kpi): boolean {
  return typeof k.value === "string" && String(k.value).includes("R$");
}

function numericValue(k: Kpi): number | null {
  if (typeof k.value === "number") return k.value;
  const n = Number(String(k.value).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
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
      p.drawText(`Fórmulas ${asText(report.formulaVersion)}  ·  pág. ${i + 1} de ${pages.length}`, {
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
  draw(`Dados atualizados em: ${formatDt(report.dataAsOf)}`, 9);
  draw(`Gerado em: ${formatDt(report.generatedAt)}`, 9);
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
    ensure(36);
    page.drawRectangle({ x: 40, y: y - 22, width: 515, height: 32, color: rgb(0.95, 0.96, 0.98) });
    page.drawText(k.label.slice(0, 70), { x: 48, y: y - 4, size: 8, font, color: MUTED });
    page.drawText(asText(k.value).slice(0, 42), { x: 48, y: y - 18, size: 11, font: bold, color: NAVY });
    y -= 40;
  }

  const counts = kpis.filter((k) => !looksLikePercent(k) && !looksLikeMoney(k) && numericValue(k) != null);
  const percents = kpis.filter((k) => looksLikePercent(k) && numericValue(k) != null);
  if (counts.length >= 2) {
    y -= 4;
    draw("Pessoas e volumes (mesma unidade: quantidade)", 11, true, NAVY);
    drawBars(
      page,
      counts.map((k) => ({ label: k.label, n: numericValue(k) ?? 0 })),
      40,
      y,
      font,
    );
    y -= 18 + counts.length * 16;
  }
  if (percents.length >= 1) {
    ensure(40 + percents.length * 16);
    draw("Percentuais (eixo de 0 a 100)", 11, true, NAVY);
    drawBars(
      page,
      percents.map((k) => ({ label: k.label, n: numericValue(k) ?? 0 })),
      40,
      y,
      font,
      100,
    );
    y -= 18 + percents.length * 16;
  }

  const alerts = (report.alerts ?? report.indicators?.alerts ?? []).slice(0, 6);
  ensure(40);
  draw("Alertas e decisões sugeridas", 13, true, NAVY);
  if (alerts.length === 0) draw("Nenhum alerta decisório neste recorte.");
  for (const a of alerts) {
    draw(asText(a.title), 10, true, AMBER);
    draw(asText(a.fact), 9);
    if (a.suggestedDecision) draw(`Decisão sugerida: ${a.suggestedDecision}`, 9);
    y -= 4;
  }

  const finKpi = kpis.find((k) => /líquid|pago|financeiro|receb/i.test(k.label));
  if (finKpi || (report.disclaimer && /saldo|banc/i.test(report.disclaimer))) {
    ensure(40);
    page.drawRectangle({ x: 40, y: y - 28, width: 515, height: 36, color: rgb(1, 0.96, 0.9) });
    y -= 8;
    draw("Ressalva financeira: valores pagos não representam saldo, caixa nem disponibilidade bancária.", 8, true, AMBER);
    y -= 16;
  }

  ensure(50);
  draw("Qualidade dos dados", 13, true, NAVY);
  const quality = Array.isArray(report.quality) ? report.quality : [];
  if (quality.length === 0) draw("Qualidade sem apontamentos.");
  for (const q of quality) {
    draw(
      `${humanDomain(q.domain)} — ${qualityStatusLabel(q.status ?? "ok")}${q.note ? `: ${q.note}` : ""}`,
      9,
    );
  }
  for (const c of report.caveats ?? []) draw(`• ${c}`, 9);

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

function formatDt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
  return lines.slice(0, 8);
}

function drawBars(
  page: PDFPage,
  items: Array<{ label: string; n: number }>,
  x: number,
  top: number,
  font: PDFFont,
  maxHint?: number,
) {
  const max = Math.max(1, maxHint ?? Math.max(...items.map((i) => i.n), 1));
  let y = top;
  for (const it of items.slice(0, 4)) {
    const w = Math.max(6, (it.n / max) * 280);
    page.drawRectangle({ x, y: y - 10, width: w, height: 10, color: rgb(0.12, 0.35, 0.55) });
    page.drawText(`${it.label.slice(0, 28)}: ${it.n}`, { x: x + 290, y: y - 9, size: 8, font, color: MUTED });
    y -= 16;
  }
}
