import type { IndicatorTone } from "@/components/coordenacao/PedagogicalMetricCard";

const TONE_BORDER: Record<IndicatorTone, string> = {
  ok: "border-emerald-500/35",
  warning: "border-amber-500/40",
  critical: "border-red-500/40",
  neutral: "border-[var(--igh-primary)]/30",
};

const TONE_BG: Record<IndicatorTone, string> = {
  ok: "bg-emerald-500/8",
  warning: "bg-amber-500/10",
  critical: "bg-red-500/10",
  neutral: "bg-[var(--igh-primary)]/8",
};

export function InsightBanner({
  headline,
  bullets,
  tone = "neutral",
}: {
  headline: string;
  bullets: string[];
  tone?: IndicatorTone;
}) {
  return (
    <section
      className={`rounded-xl border px-4 py-4 sm:px-5 ${TONE_BORDER[tone]} ${TONE_BG[tone]}`}
      aria-label="O que olhar primeiro"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        O que olhar primeiro
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{headline}</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[var(--text-secondary)]">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </section>
  );
}
