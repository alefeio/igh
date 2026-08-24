export type PdfBarInput = {
  label: string;
  currentValue?: number | null;
  targetValue?: number | null;
  percentage?: number | null;
  unit?: string;
  formattedValue?: string;
  quality?: string;
};

export type PdfBarSeries = {
  label: string;
  /** 0–100 for percent series; raw count otherwise. Null = no bar. */
  plot: number | null;
  display: string;
  kind: "percent" | "count" | "unavailable";
};

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function formatPtPercent(n: number): string {
  return `${clampPercent(n).toLocaleString("pt-BR", { minimumFractionDigits: n % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })}%`;
}

export function resolvePdfBar(k: PdfBarInput, axis: "percent" | "count"): PdfBarSeries {
  if (k.quality === "unavailable") {
    return { label: k.label, plot: null, display: k.formattedValue ?? "Indisponível", kind: "unavailable" };
  }
  if (axis === "percent") {
    const raw = k.percentage ?? (typeof k.currentValue === "number" && k.unit === "%" ? k.currentValue : null);
    if (raw == null || !Number.isFinite(raw)) {
      return { label: k.label, plot: null, display: k.formattedValue ?? "Indisponível", kind: "unavailable" };
    }
    const pct = clampPercent(raw);
    return {
      label: k.label,
      plot: pct,
      display: k.formattedValue ?? formatPtPercent(pct),
      kind: "percent",
    };
  }
  const n = k.currentValue;
  if (n == null || !Number.isFinite(n)) {
    return { label: k.label, plot: null, display: k.formattedValue ?? "Indisponível", kind: "unavailable" };
  }
  return {
    label: k.label,
    plot: n,
    display: k.formattedValue ?? n.toLocaleString("pt-BR"),
    kind: "count",
  };
}

/** Largura da barra em pontos, limitada a maxWidth. 0% → 0. Indisponível → null. */
export function pdfBarWidth(plot: number | null, max: number, maxWidth: number): number | null {
  if (plot == null || !Number.isFinite(plot) || max <= 0) return null;
  const ratio = Math.min(1, Math.max(0, plot / max));
  return ratio * maxWidth;
}
