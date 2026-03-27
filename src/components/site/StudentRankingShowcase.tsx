import type { StudentRankEntry } from "@/lib/student-gamification-ranking";
import { Container } from "./Container";
import { Section } from "./Section";

const MEDALS = ["🥇", "🥈", "🥉"] as const;

function PodiumCard({
  entry,
  place,
  tall,
}: {
  entry: StudentRankEntry;
  place: 1 | 2 | 3;
  tall: "tall" | "mid" | "short";
}) {
  const h =
    tall === "tall" ? "min-h-[200px]" : tall === "mid" ? "min-h-[168px]" : "min-h-[140px]";
  /**
   * Coluna (mobile): 1º → 2º → 3º (order 1,2,3).
   * Linha (sm+): pódio 2º | 1º | 3º — ordens explícitas (não depender só do DOM).
   */
  const order =
    place === 1
      ? "order-1 sm:order-2"
      : place === 2
        ? "order-2 sm:order-1"
        : "order-3 sm:order-3";
  const gradient =
    place === 1
      ? "from-amber-400/90 via-amber-300/40 to-violet-500/25"
      : place === 2
        ? "from-slate-300/80 via-slate-200/30 to-sky-400/20"
        : "from-orange-300/80 via-amber-700/15 to-rose-400/20";

  return (
    <div
      className={`relative flex w-full max-w-[200px] flex-col items-center sm:flex-1 ${order} ${h} justify-end sm:max-w-none`}
    >
      <div
        className="mb-2 text-4xl drop-shadow-sm"
        aria-hidden
      >
        {MEDALS[place - 1]}
      </div>
      <div
        className={`w-full rounded-2xl border border-white/40 bg-gradient-to-b ${gradient} p-4 text-center shadow-lg backdrop-blur-sm dark:border-white/10`}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--igh-secondary)]/90">
          {place}º lugar
        </p>
        <p className="mt-1 line-clamp-2 text-base font-bold text-[var(--text-primary)]">{entry.displayName}</p>
        <p className="mt-1 text-xs font-medium text-[var(--igh-muted)]">{entry.levelName}</p>
        <p className="mt-2 text-2xl font-black tabular-nums text-[var(--igh-primary)]">{entry.points} pts</p>
      </div>
    </div>
  );
}

export function StudentRankingShowcase({
  items,
}: {
  items: readonly StudentRankEntry[];
}) {
  if (items.length === 0) return null;

  const first = items[0];
  const second = items[1];
  const third = items[2];
  const rest = items.slice(3);
  const showPodium = items.length >= 3;

  return (
    <Section
      title="Ranking dos alunos"
      subtitle="Quem tá voando na gamificação — aulas, exercícios, presença e fórum viram pontos!"
      background="muted"
      headerClassName="mb-3 text-center sm:mb-4"
    >
      <Container>
        {showPodium && first && second && third && (
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-4 sm:flex-row sm:items-end sm:gap-3">
            <PodiumCard entry={second} place={2} tall="mid" />
            <PodiumCard entry={first} place={1} tall="tall" />
            <PodiumCard entry={third} place={3} tall="short" />
          </div>
        )}

        {!showPodium && items.length > 0 && (
          <ul className="mx-auto mt-4 flex max-w-md flex-col gap-3">
            {items.map((entry, i) => (
              <li
                key={entry.studentId}
                className="flex items-center gap-4 rounded-2xl border border-[var(--igh-border)] bg-[var(--card-bg)] px-4 py-4 shadow-sm"
              >
                <span className="text-2xl" aria-hidden>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[var(--text-primary)]">{entry.displayName}</p>
                  <p className="text-xs text-[var(--igh-muted)]">{entry.levelName}</p>
                </div>
                <p className="shrink-0 text-lg font-black tabular-nums text-[var(--igh-primary)]">{entry.points} pts</p>
              </li>
            ))}
          </ul>
        )}

        {showPodium && rest.length > 0 && (
          <ul className="mx-auto mt-10 grid max-w-2xl gap-2 sm:grid-cols-2">
            {rest.map((r) => (
              <li
                key={r.studentId}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--igh-border)] bg-[var(--card-bg)] px-4 py-3 text-sm shadow-sm"
              >
                <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--igh-primary)]/15 text-xs font-bold text-[var(--igh-primary)]">
                    {r.rank}
                  </span>
                  <span className="line-clamp-1">{r.displayName}</span>
                </span>
                <span className="shrink-0 tabular-nums font-bold text-[var(--igh-primary)]">{r.points} pts</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mx-auto mt-10 max-w-3xl text-center">
          <p className="text-lg font-semibold text-[var(--igh-secondary)]">
            Bora subir no pódio? Estude, participe e dispute o topo! 🚀✨
          </p>
        </div>
      </Container>
    </Section>
  );
}
