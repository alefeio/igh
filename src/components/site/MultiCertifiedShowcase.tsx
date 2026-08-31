"use client";

import { Award } from "lucide-react";

import type {
  MultiCertifiedShowcasePayload,
  MultiCertifiedStudentEntry,
  MultiCertTier,
} from "@/lib/student-multi-certification-shared";

import { Card } from "./Card";
import { Container } from "./Container";
import { Section } from "./Section";

const TIER_LABEL: Record<MultiCertTier, string> = {
  silver: "2 certificações",
  gold: "3 certificações",
  platinum: "4+ certificações",
};

function tierCardClass(tier: MultiCertTier, highlighted: boolean): string {
  const base =
    "flex flex-col items-center rounded-2xl border px-4 py-5 text-center shadow-sm transition";
  const ring = highlighted ? " ring-2 ring-[var(--igh-primary)] ring-offset-2" : "";
  if (tier === "platinum") {
    return `${base}${ring} border-violet-300/70 bg-gradient-to-b from-violet-500/15 via-[var(--card-bg)] to-fuchsia-500/10 sm:min-h-[168px] sm:scale-[1.03]`;
  }
  if (tier === "gold") {
    return `${base}${ring} border-amber-300/70 bg-gradient-to-b from-amber-400/20 via-[var(--card-bg)] to-orange-400/10 sm:min-h-[156px]`;
  }
  return `${base}${ring} border-[var(--igh-border)] bg-[var(--card-bg)] sm:min-h-[140px]`;
}

function MedalRow({ count, tier }: { count: number; tier: MultiCertTier }) {
  const medalClass =
    tier === "platinum"
      ? "text-violet-600 dark:text-violet-400"
      : tier === "gold"
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-500 dark:text-slate-400";

  return (
    <div className="flex flex-wrap items-center justify-center gap-1" aria-hidden>
      {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
        <Award key={i} className={`h-5 w-5 ${medalClass}`} fill="currentColor" strokeWidth={1.25} />
      ))}
      {count > 5 ? (
        <span className="text-xs font-bold text-[var(--igh-muted)]">+{count - 5}</span>
      ) : null}
    </div>
  );
}

function StudentCertCard({
  entry,
  highlighted,
  compact,
}: {
  entry: MultiCertifiedStudentEntry;
  highlighted?: boolean;
  compact?: boolean;
}) {
  return (
    <article className={tierCardClass(entry.tier, highlighted === true)}>
      <MedalRow count={entry.certificationCount} tier={entry.tier} />
      <p
        className={`mt-3 font-bold text-[var(--text-primary)] ${compact ? "text-sm" : "text-base"} line-clamp-2`}
      >
        {entry.displayName}
      </p>
      <p className="mt-1 text-xs font-medium text-[var(--igh-muted)]">
        {entry.certificationCount}{" "}
        {entry.certificationCount === 1 ? "certificação" : "certificações"}
      </p>
      {!compact ? (
        <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--igh-muted)]/80">
          {TIER_LABEL[entry.tier]}
        </p>
      ) : null}
    </article>
  );
}

export function MultiCertifiedShowcase({
  data,
  variant = "public",
  highlightStudentId,
  title,
  subtitle,
}: {
  data: MultiCertifiedShowcasePayload;
  variant?: "public" | "compact";
  highlightStudentId?: string | null;
  title?: string;
  subtitle?: string;
}) {
  if (data.entries.length === 0) return null;

  const isCompact = variant === "compact";
  const sectionTitle = title ?? "Alunos em qualificação contínua";
  const sectionSubtitle =
    subtitle ??
    (isCompact
      ? "Quem já concluiu 2 ou mais cursos no instituto."
      : "Reconhecemos quem investe em formação continuada — quanto mais cursos concluídos, maior o destaque.");

  const grid = (
    <div
      className={
        isCompact
          ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          : "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      }
    >
      {data.entries.map((entry) => (
        <StudentCertCard
          key={entry.studentId}
          entry={entry}
          highlighted={highlightStudentId != null && entry.studentId === highlightStudentId}
          compact={isCompact}
        />
      ))}
    </div>
  );

  if (isCompact) {
    return (
      <div className="space-y-4">
        {grid}
        {data.hiddenCount > 0 ? (
          <p className="text-center text-xs text-[var(--text-muted)]">
            e mais {data.hiddenCount} {data.hiddenCount === 1 ? "aluno" : "alunos"} com 2 ou mais certificações
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Section title={sectionTitle} subtitle={sectionSubtitle} background="muted" headerClassName="text-center">
      <Container>
        {grid}
        {data.hiddenCount > 0 ? (
          <p className="mt-8 text-center text-sm text-[var(--igh-muted)]">
            e mais {data.hiddenCount} {data.hiddenCount === 1 ? "aluno" : "alunos"} com 2 ou mais certificações
          </p>
        ) : null}
        <div className="mx-auto mt-8 max-w-2xl text-center">
          <p className="text-base font-semibold text-[var(--igh-secondary)]">
            Sua próxima certificação pode colocar você aqui. Explore o catálogo e continue aprendendo.
          </p>
        </div>
      </Container>
    </Section>
  );
}

export function MultiCertifiedShowcaseEmptyHint() {
  return (
    <Card as="article" className="border-dashed text-center">
      <p className="text-sm text-[var(--igh-muted)]">
        Quando alunos concluírem um segundo curso, os nomes aparecerão neste mural.
      </p>
    </Card>
  );
}
