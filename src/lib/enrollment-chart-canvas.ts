export type ChartSeriesItem = {
  label: string;
  primary: number;
  secondary?: number;
};

export type DrawnChartPng = {
  title: string;
  bytes: Uint8Array;
  width: number;
  height: number;
};

function truncateLabel(label: string, max = 28): string {
  const cleaned = label.trim() || "—";
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

/** Desenha gráfico de barras comparativo (ex.: matriculados × formados) no canvas do browser. */
export function drawGroupedBarChartPng(params: {
  title: string;
  items: ChartSeriesItem[];
  primaryLabel: string;
  secondaryLabel?: string;
  width?: number;
  height?: number;
}): DrawnChartPng | null {
  if (typeof document === "undefined") return null;
  const items = params.items.filter((item) => item.primary > 0 || (item.secondary ?? 0) > 0).slice(0, 12);
  if (items.length === 0) return null;

  const width = params.width ?? 920;
  const rowH = 34;
  const top = 56;
  const bottom = 48;
  const height = params.height ?? top + items.length * rowH + bottom;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 20px Segoe UI, Arial, sans-serif";
  ctx.fillText(params.title, 24, 32);

  const labelW = 220;
  const barStart = 24 + labelW + 12;
  const barMaxW = width - barStart - 120;
  const maxValue = Math.max(...items.map((i) => Math.max(i.primary, i.secondary ?? 0)), 1);

  ctx.font = "12px Segoe UI, Arial, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(params.primaryLabel, barStart, 48);
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(barStart - 16, 38, 10, 10);
  if (params.secondaryLabel) {
    ctx.fillStyle = "#059669";
    ctx.fillRect(barStart + 110, 38, 10, 10);
    ctx.fillStyle = "#64748b";
    ctx.fillText(params.secondaryLabel, barStart + 126, 48);
  }

  items.forEach((item, index) => {
    const y = top + index * rowH;
    ctx.fillStyle = "#334155";
    ctx.font = "13px Segoe UI, Arial, sans-serif";
    ctx.fillText(truncateLabel(item.label), 24, y + 18);

    const primaryW = (item.primary / maxValue) * barMaxW;
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(barStart, y + 4, Math.max(primaryW, item.primary > 0 ? 2 : 0), 12);

    if (params.secondaryLabel != null) {
      const secondaryW = ((item.secondary ?? 0) / maxValue) * barMaxW;
      ctx.fillStyle = "#059669";
      ctx.fillRect(barStart, y + 18, Math.max(secondaryW, (item.secondary ?? 0) > 0 ? 2 : 0), 10);
    }

    ctx.fillStyle = "#0f172a";
    ctx.font = "12px Segoe UI, Arial, sans-serif";
    const valueText =
      params.secondaryLabel != null
        ? `${item.primary} / ${item.secondary ?? 0}`
        : String(item.primary);
    ctx.fillText(valueText, barStart + barMaxW + 12, y + 18);
  });

  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { title: params.title, bytes, width, height };
}

export function drawKpiStripPng(params: {
  title: string;
  metrics: Array<{ label: string; value: string }>;
}): DrawnChartPng | null {
  if (typeof document === "undefined") return null;
  const width = 920;
  const height = 140;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 18px Segoe UI, Arial, sans-serif";
  ctx.fillText(params.title, 24, 28);

  const cardW = Math.floor((width - 48 - (params.metrics.length - 1) * 12) / Math.max(params.metrics.length, 1));
  params.metrics.forEach((metric, index) => {
    const x = 24 + index * (cardW + 12);
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.fillRect(x, 44, cardW, 72);
    ctx.strokeRect(x, 44, cardW, 72);
    ctx.fillStyle = "#64748b";
    ctx.font = "12px Segoe UI, Arial, sans-serif";
    ctx.fillText(metric.label, x + 14, 68);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 28px Segoe UI, Arial, sans-serif";
    ctx.fillText(metric.value, x + 14, 100);
  });

  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { title: params.title, bytes, width, height };
}
