import type { PlatformExperiencePublicBlock } from "@/lib/site-data";
import { Container } from "./Container";

function overallAvg(block: PlatformExperiencePublicBlock): number | null {
  const { avgPlatform, avgLessons, avgTeacher } = block;
  const vals = [avgPlatform, avgLessons, avgTeacher].filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

type CompactStat = { value: string; label: string };

/**
 * Prova social curta acima do catálogo: avaliação + 2–3 números de impacto.
 */
export function HomePublicRatingStrip({
  block,
  stats = [],
}: {
  block: PlatformExperiencePublicBlock;
  stats?: readonly CompactStat[];
}) {
  const { totalCount, avgPlatform, avgLessons, avgTeacher } = block;
  const hasAvg = avgPlatform != null || avgLessons != null || avgTeacher != null;
  const overall = overallAvg(block);
  const compactStats = stats.slice(0, 3);
  const showRating = totalCount > 0 && hasAvg;

  if (!showRating && compactStats.length === 0) return null;

  return (
    <div className="border-b border-[var(--igh-border)] bg-gradient-to-r from-[var(--igh-primary)]/10 via-[var(--card-bg)] to-violet-500/10 py-4 sm:py-5">
      <Container>
        {showRating && (
          <p className="text-center text-sm text-[var(--text-primary)] sm:text-base">
            <span className="font-semibold text-[var(--igh-secondary)]">Alunos confiam no IGH:</span>{" "}
            {overall != null && (
              <>
                média{" "}
                <span className="tabular-nums font-bold text-[var(--igh-primary)]">{overall.toFixed(1)}</span>
                /10
              </>
            )}{" "}
            com base em{" "}
            <span className="tabular-nums font-semibold">{totalCount}</span>{" "}
            {totalCount === 1 ? "avaliação" : "avaliações"}.{" "}
            <a
              href="#avaliacoes-alunos"
              className="font-semibold text-[var(--igh-primary)] underline decoration-[var(--igh-primary)]/40 underline-offset-2 hover:decoration-[var(--igh-primary)]"
            >
              Ver detalhes
            </a>
          </p>
        )}
        {compactStats.length > 0 && (
          <dl
            className={`grid grid-cols-3 gap-3 ${showRating ? "mt-4 border-t border-[var(--igh-border)]/60 pt-4" : ""}`}
          >
            {compactStats.map((item) => (
              <div key={item.label} className="text-center">
                <dt className="sr-only">{item.label}</dt>
                <dd className="text-lg font-bold tabular-nums text-[var(--igh-primary)] sm:text-xl">{item.value}</dd>
                <p className="mt-0.5 text-[11px] font-medium leading-tight text-[var(--igh-muted)] sm:text-xs">
                  {item.label}
                </p>
              </div>
            ))}
          </dl>
        )}
      </Container>
    </div>
  );
}
