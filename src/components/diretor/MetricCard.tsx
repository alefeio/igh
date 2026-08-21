"use client";

import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  unit,
  formula,
  denominator,
  period,
  quality,
  unavailableReason,
  href,
}: {
  label: string;
  value: number | string | null;
  unit?: string;
  formula?: string;
  denominator?: string;
  period?: string;
  quality: string;
  unavailableReason?: string | null;
  href?: string;
}) {
  const display =
    value === null || value === undefined
      ? unavailableReason || "Indisponível"
      : unavailableReason
        ? unavailableReason
        : typeof value === "number" && unit === "%"
          ? `${value}%`
          : String(value);

  const tip = [formula, denominator ? `Denominador: ${denominator}` : null, period ? `Período: ${period}` : null]
    .filter(Boolean)
    .join(" · ");

  const inner = (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p
        className="mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]"
        title={tip || undefined}
      >
        {display}
      </p>
      {formula ? (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]" title={tip || formula}>
          {formula}
          {denominator ? ` · denom.: ${denominator}` : ""}
        </p>
      ) : null}
      {quality !== "ok" ? (
        <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          Qualidade: {quality}
        </p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block transition hover:opacity-95">
        {inner}
      </a>
    );
  }
  return inner;
}

export function ChartWithTable({
  title,
  description,
  formula,
  children,
  table,
}: {
  title: string;
  description?: string;
  formula?: string;
  children: ReactNode;
  table: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
      <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
      {description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p> : null}
      {formula ? (
        <p className="mt-1 text-xs text-[var(--text-muted)]" title={formula}>
          Fórmula: {formula}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
      <div className="mt-4 overflow-x-auto">{table}</div>
    </section>
  );
}
