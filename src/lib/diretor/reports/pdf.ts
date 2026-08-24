import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { BRAND } from "@/lib/brand";

type Report = {
  title: string;
  institution?: string;
  period?: unknown;
  generatedAt?: string;
  dataAsOf?: string;
  formulaVersion?: string;
  indicators?: { kpis?: Array<{ label: string; value: unknown; formula?: string }>; alerts?: Array<{ title: string; fact: string }> };
  alerts?: Array<{ title?: string; fact?: string; suggestedDecision?: string }>;
  quality?: unknown;
  caveats?: string[];
  disclaimer?: string;
};

function text(v: unknown): string {
  if (v == null) return "—";
  return String(v).slice(0, 180);
}

export async function buildDirectorPdf(report: Report): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 800;
  const brand = `${BRAND.shortName} — ${BRAND.legalName}`;

  const draw = (s: string, size = 10, b = false) => {
    if (y < 60) {
      page.drawText(`Pág. ${doc.getPageCount()}`, { x: 520, y: 24, size: 8, font });
      page = doc.addPage([595, 842]);
      y = 800;
    }
    page.drawText(s.slice(0, 110), { x: 40, y, size, font: b ? bold : font, color: rgb(0.1, 0.1, 0.15) });
    y -= size + 6;
  };

  draw(brand, 9);
  draw(report.title, 16, true);
  draw(`Período/filtros: ${text(JSON.stringify(report.period))}`, 9);
  draw(`Data de referência (dataAsOf): ${text(report.dataAsOf)}`, 9);
  draw(`Gerado em: ${text(report.generatedAt)} · Fórmulas ${text(report.formulaVersion)}`, 9);
  y -= 6;
  draw("Síntese executiva", 12, true);
  draw("Indicadores abaixo usam as mesmas fórmulas das páginas do Diretor. Sem dados pessoais.");
  y -= 4;
  draw("KPIs", 12, true);
  const kpis = report.indicators?.kpis ?? [];
  const top = kpis.slice(0, 6);
  for (const k of top) {
    draw(`• ${text(k.label)}: ${text(k.value)}`);
  }
  if (top.length >= 2) {
    y -= 8;
    draw("Gráfico: magnitude relativa dos dois primeiros KPIs numéricos", 10, true);
    const nums = top
      .map((k) => ({ l: text(k.label).slice(0, 18), n: typeof k.value === "number" ? k.value : Number(String(k.value).replace(/[^\d.-]/g, "")) }))
      .filter((x) => Number.isFinite(x.n) && x.n >= 0)
      .slice(0, 3);
    const max = Math.max(1, ...nums.map((x) => x.n));
    for (const x of nums) {
      const w = Math.max(8, (x.n / max) * 400);
      page.drawRectangle({ x: 40, y: y - 4, width: w, height: 10, color: rgb(0.15, 0.35, 0.55) });
      draw(`${x.l}: ${x.n}`);
    }
  }
  y -= 6;
  draw("Alertas", 12, true);
  const alerts = (report.alerts ?? report.indicators?.alerts ?? []).slice(0, 5);
  if (alerts.length === 0) draw("Nenhum alerta neste recorte.");
  for (const a of alerts) {
    draw(`• ${text(a.title)}`, 10, true);
    draw(`  ${text(a.fact)}`, 9);
    if ("suggestedDecision" in a && a.suggestedDecision) draw(`  Decisão: ${text(a.suggestedDecision)}`, 9);
  }
  y -= 6;
  draw("Qualidade e ressalvas", 12, true);
  draw(text(JSON.stringify(report.quality)).slice(0, 200), 8);
  for (const c of (report.caveats ?? []).slice(0, 6)) draw(`• ${c}`, 9);
  draw(text(report.disclaimer), 8);
  page.drawText(`Pág. ${doc.getPageCount()}`, { x: 520, y: 24, size: 8, font });
  return doc.save();
}
