"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

export function MetricCard({
  label,
  value,
  unit,
  formula,
  explanation,
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
  explanation?: string;
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

  const how = explanation || (formula && !/[A-Z_]{3,}|COUNT |studentId|paidAt|entryDate/.test(formula) ? formula : null);
  const qualityLabel =
    quality === "partial" ? "Leitura provisória" : quality === "unavailable" ? "Não calculável" : null;

  const inner = (
    <div
      className={`rounded-xl border bg-[var(--card-bg)] p-4 shadow-sm ${
        quality === "partial"
          ? "border-amber-400"
          : quality === "unavailable"
            ? "border-[var(--card-border)] opacity-80"
            : "border-[var(--card-border)]"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold tabular-nums text-[var(--text-primary)]">{display}</p>
      {qualityLabel ? (
        <p className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">{qualityLabel}</p>
      ) : null}
      {how ? (
        <details className="mt-2 text-[11px] text-[var(--text-muted)]">
          <summary className="cursor-pointer font-medium">Como este indicador é calculado?</summary>
          <p className="mt-1">
            {how}
            {denominator ? ` Denominador: ${denominator}.` : ""}
            {period ? ` Recorte: ${period}.` : ""}
          </p>
        </details>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition hover:opacity-95">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function ChartWithTable({
  title,
  description,
  children,
  table,
}: {
  title: string;
  description?: string;
  formula?: string;
  children: ReactNode;
  table: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm">
      <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
      {description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p> : null}
      <div className="mt-4 min-w-0 overflow-x-auto">
        <div className="min-w-[520px] sm:min-w-0">{children}</div>
      </div>
      <button
        type="button"
        className="mt-3 text-sm font-semibold text-[var(--igh-primary)]"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Ocultar dados do gráfico" : "Ver dados do gráfico"}
      </button>
      {open ? <div className="mt-3 overflow-x-auto text-sm">{table}</div> : null}
    </section>
  );
}

export function formatAxisReais(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
