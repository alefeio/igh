export type IndicatorTone = "ok" | "warning" | "critical" | "neutral";

const TONE_BORDER: Record<IndicatorTone, string> = {
  ok: "border-emerald-500/40",
  warning: "border-amber-500/40",
  critical: "border-red-500/40",
  neutral: "border-[var(--card-border)]",
};

const TONE_BG: Record<IndicatorTone, string> = {
  ok: "bg-emerald-500/5",
  warning: "bg-amber-500/5",
  critical: "bg-red-500/5",
  neutral: "bg-[var(--card-bg)]",
};

export function PedagogicalMetricCard({
  label,
  value,
  meaning,
  tone = "neutral",
}: {
  label: string;
  value: string;
  meaning: string;
  tone?: IndicatorTone;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${TONE_BORDER[tone]} ${TONE_BG[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
        <span className="font-medium text-[var(--text-primary)]">O que isso significa: </span>
        {meaning}
      </p>
    </div>
  );
}
