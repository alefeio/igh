import Link from "next/link";

import { SectionCard } from "@/components/dashboard/DashboardUI";
import type { PlatformExperienceDashboardSummary } from "@/lib/dashboard-data";

export function PlatformExperienceSummarySection({
  summary,
  href,
  title,
  description,
  className = "",
  contentClassName = "",
}: {
  summary: PlatformExperienceDashboardSummary;
  href: string;
  title: string;
  description: string;
  className?: string;
  contentClassName?: string;
}) {
  const fmt = (n: number | null) => (n == null ? "—" : n.toFixed(1));
  return (
    <SectionCard
      title={title}
      description={description}
      id="platform-exp-summary-heading"
      variant="elevated"
      className={className}
      contentClassName={contentClassName}
      action={
        <Link
          href={href}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--igh-primary)] transition hover:bg-[var(--igh-primary)]/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] focus-visible:ring-offset-2"
        >
          Ver detalhes →
        </Link>
      }
    >
      <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/50 p-3 sm:p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Respostas</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{summary.totalCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/50 p-3 sm:p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Plataforma</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            {fmt(summary.avgPlatform)}
            <span className="text-sm font-normal text-[var(--text-muted)]">/10</span>
          </p>
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/50 p-3 sm:p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Aulas</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            {fmt(summary.avgLessons)}
            <span className="text-sm font-normal text-[var(--text-muted)]">/10</span>
          </p>
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/50 p-3 sm:p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Professor</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            {fmt(summary.avgTeacher)}
            <span className="text-sm font-normal text-[var(--text-muted)]">/10</span>
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
