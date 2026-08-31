import { Trophy } from "lucide-react";

import type { MultiCertifiedStudentEntry, MultiCertTier } from "@/lib/student-multi-certification-shared";

function tierCardClass(tier: MultiCertTier, highlighted: boolean): string {
  const base =
    "flex flex-col items-center rounded-2xl border px-3 py-4 text-center shadow-sm transition sm:px-4 sm:py-5";
  const ring = highlighted ? " ring-2 ring-[var(--igh-primary)] ring-offset-2" : "";
  if (tier === "platinum") {
    return `${base}${ring} border-violet-300/70 bg-gradient-to-b from-violet-500/15 via-[var(--card-bg)] to-fuchsia-500/10 sm:min-h-[168px] sm:scale-[1.03]`;
  }
  if (tier === "gold") {
    return `${base}${ring} border-amber-300/70 bg-gradient-to-b from-amber-400/25 via-[var(--card-bg)] to-orange-400/10 sm:min-h-[156px]`;
  }
  return `${base}${ring} border-[var(--igh-border)] bg-[var(--card-bg)] sm:min-h-[140px]`;
}

function trophyClass(tier: MultiCertTier): string {
  if (tier === "platinum") return "text-violet-500 dark:text-violet-400";
  if (tier === "gold") return "text-amber-500 dark:text-amber-400";
  return "text-slate-400 dark:text-slate-500";
}

function TrophyRow({ count, tier, size = "md" }: { count: number; tier: MultiCertTier; size?: "md" | "lg" }) {
  const iconSize = size === "lg" ? "h-7 w-7 sm:h-8 sm:w-8" : "h-6 w-6 sm:h-7 sm:w-7";
  const shown = Math.min(count, 5);

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-1"
      aria-label={`${count} certificações`}
    >
      {Array.from({ length: shown }).map((_, i) => (
        <Trophy
          key={i}
          className={`${iconSize} ${trophyClass(tier)}`}
          fill="currentColor"
          strokeWidth={1.5}
          aria-hidden
        />
      ))}
      {count > 5 ? (
        <span className="ml-1 text-xs font-bold text-[var(--igh-muted)]">+{count - 5}</span>
      ) : null}
    </div>
  );
}

export function MultiCertifiedStudentCard({
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
      <TrophyRow count={entry.certificationCount} tier={entry.tier} size={compact ? "md" : "lg"} />
      <p
        className={`mt-3 font-bold text-[var(--text-primary)] ${compact ? "text-sm" : "text-base"} line-clamp-2`}
      >
        {entry.displayName}
      </p>
      <p className="mt-1 text-xs font-medium text-[var(--igh-muted)]">
        {entry.certificationCount}{" "}
        {entry.certificationCount === 1 ? "certificação" : "certificações"}
      </p>
    </article>
  );
}

export function MultiCertifiedGrid({
  entries,
  highlightStudentId,
  compact,
}: {
  entries: readonly MultiCertifiedStudentEntry[];
  highlightStudentId?: string | null;
  compact?: boolean;
}) {
  if (entries.length === 0) return null;

  return (
    <div
      className={
        compact
          ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      }
    >
      {entries.map((entry) => (
        <MultiCertifiedStudentCard
          key={entry.studentId}
          entry={entry}
          highlighted={highlightStudentId != null && entry.studentId === highlightStudentId}
          compact={compact}
        />
      ))}
    </div>
  );
}
