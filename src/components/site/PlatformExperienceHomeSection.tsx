import type { PlatformExperiencePublicBlock } from "@/lib/site-data";
import { Container } from "./Container";
import { Section } from "./Section";

function StarRow({ value }: { value: number }) {
  const full = Math.round(value / 2);
  return (
    <span className="inline-flex gap-0.5 text-amber-400" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? "opacity-100" : "opacity-25"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function PlatformExperienceHomeSection({ block }: { block: PlatformExperiencePublicBlock }) {
  const { totalCount, avgPlatform, avgLessons, avgTeacher, snippets } = block;
  const hasAvg = avgPlatform != null || avgLessons != null || avgTeacher != null;

  if (totalCount === 0 && snippets.length === 0) {
    return null;
  }

  return (
    <Section
      title="O que os alunos avaliam"
      subtitle="Feedback de quem estuda aqui."
    >
      <Container>
        {hasAvg && totalCount > 0 && (
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              { label: "Plataforma", value: avgPlatform, hint: "Navegação e uso" },
              { label: "Aulas & conteúdo", value: avgLessons, hint: "Materiais e dinâmica" },
              { label: "Professores", value: avgTeacher, hint: "Apoio em sala" },
            ].map((c) => (
              <div
                key={c.label}
                className="relative overflow-hidden rounded-2xl border border-[var(--igh-border)] bg-gradient-to-br from-[var(--igh-primary)]/12 via-[var(--card-bg)] to-violet-500/10 p-6 shadow-md"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--igh-primary)]/20 blur-2xl" aria-hidden />
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--igh-muted)]">{c.hint}</p>
                <p className="mt-1 text-lg font-bold text-[var(--igh-secondary)]">{c.label}</p>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-black tabular-nums text-[var(--text-primary)]">
                    {c.value != null ? c.value.toFixed(1) : "—"}
                  </span>
                  <span className="text-sm font-semibold text-[var(--igh-muted)]">/10</span>
                </p>
                {c.value != null && (
                  <p className="mt-2">
                    <StarRow value={c.value} />
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {snippets.length > 0 && (
          <div className={`mx-auto max-w-5xl ${hasAvg && totalCount > 0 ? "mt-12" : "mt-2"}`}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {snippets.map((s) => (
                <figure
                  key={s.id}
                  className="group flex h-full flex-col rounded-2xl border border-[var(--igh-border)] bg-[var(--card-bg)] p-5 shadow-sm transition hover:border-[var(--igh-primary)]/35 hover:shadow-md"
                >
                  <blockquote className="flex-1 text-sm leading-relaxed text-[var(--text-primary)]">
                    <span className="text-2xl leading-none text-[var(--igh-primary)] opacity-80" aria-hidden>
                      “
                    </span>
                    {s.text}
                    <span className="text-2xl leading-none text-[var(--igh-primary)] opacity-80" aria-hidden>
                      ”
                    </span>
                  </blockquote>
                  <figcaption className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--igh-border)] pt-4 text-xs">
                    <span className="font-bold text-[var(--igh-secondary)]">{s.author}</span>
                    <span className="tabular-nums text-[var(--igh-muted)]" title="Média das três notas nesta avaliação">
                      {s.avgRow.toFixed(1)}/10
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </Container>
    </Section>
  );
}
