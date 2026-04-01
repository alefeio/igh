import type { PlatformExperiencePublicBlock } from "@/lib/site-data";
import { Container } from "./Container";

function overallAvg(block: PlatformExperiencePublicBlock): number | null {
  const { avgPlatform, avgLessons, avgTeacher } = block;
  const vals = [avgPlatform, avgLessons, avgTeacher].filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Resumo curto das médias de avaliação (quando há dados), com link para a secção completa.
 */
export function HomePublicRatingStrip({ block }: { block: PlatformExperiencePublicBlock }) {
  const { totalCount, avgPlatform, avgLessons, avgTeacher } = block;
  const hasAvg = avgPlatform != null || avgLessons != null || avgTeacher != null;
  const overall = overallAvg(block);

  if (totalCount === 0 || !hasAvg) return null;

  return (
    <div className="border-b border-[var(--igh-border)] bg-gradient-to-r from-[var(--igh-primary)]/10 via-[var(--card-bg)] to-violet-500/10 py-3 sm:py-4">
      <Container>
        <p className="text-center text-sm text-[var(--text-primary)] sm:text-base">
          <span className="font-semibold text-[var(--igh-secondary)]">Experiência na plataforma:</span>{" "}
          {overall != null && (
            <>
              média geral{" "}
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
      </Container>
    </div>
  );
}
