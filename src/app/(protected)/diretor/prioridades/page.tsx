"use client";

import { useEffect, Suspense } from "react";
import Link from "next/link";

import {
  DirectorScopeControls,
  useDirectorApiQuery,
  useFetchJson,
} from "@/components/diretor/DirectorScopeControls";
import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";
import { domainLabel, formatUpdatedAt, severityLabel } from "@/lib/diretor/ui-labels";

type PrioritiesData = {
  meta: { dataAsOf: string; generatedAt: string };
  cycleLabel: string;
  cycles: Array<{ id: string; label: string; isCurrent: boolean }>;
  alerts: Array<{
    id: string;
    domain: string;
    severity: string;
    title: string;
    fact: string;
    impact?: string;
    period?: string;
    suggestedDecision?: string;
    href: string;
    source: string;
    status?: string;
    operationalOwner?: string;
  }>;
  qualityNotes: string[];
};

function Inner() {
  const qs = useDirectorApiQuery();
  const { data, error, loading, load } = useFetchJson<PrioritiesData>(
    `/api/diretor/priorities?${qs}`,
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Prioridades"
        title="O que exige atenção da Direção?"
        description="O que exige decisão agora, a partir dos indicadores das páginas temáticas."
        rightSlot={
          <DirectorScopeControls
            cycles={data?.cycles ?? []}
            loading={loading}
            onRefresh={() => void load()}
          />
        }
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {data ? (
        <>
          <p className="text-sm text-[var(--text-muted)]">
            Recorte: <strong>{data.cycleLabel}</strong> · Dados atualizados em {formatUpdatedAt(data.meta.dataAsOf)}
          </p>
          {data.alerts.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhum alerta no recorte.</p>
          ) : (
            <ul className="space-y-3">
              {data.alerts.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    <span>{severityLabel(a.severity)}</span>
                    <span>·</span>
                    <span>{domainLabel(a.domain)}</span>
                  </div>
                  <h3 className="mt-1 text-base font-bold">{a.title}</h3>
                  <p className="mt-1 text-sm"><strong>Fato:</strong> {a.fact}</p>
                  {a.impact ? <p className="mt-1 text-sm"><strong>Impacto:</strong> {a.impact}</p> : null}
                  {a.period ? <p className="mt-1 text-xs text-[var(--text-muted)]">Período: {a.period}</p> : null}
                  {a.suggestedDecision ? (
                    <p className="mt-2 text-sm font-medium">Decisão sugerida: {a.suggestedDecision}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Origem: {a.source}
                    {a.status ? ` · Situação: ${a.status}` : ""}
                    {a.operationalOwner ? ` · Responsável: ${a.operationalOwner}` : ""}
                  </p>
                  <Link href={a.href} className="mt-2 inline-block text-sm font-semibold text-[var(--igh-primary)]">
                    Abrir página temática →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </PanelPageStack>
  );
}

export default function PrioridadesPage() {
  return (
    <Suspense fallback={<p className="text-sm">Carregando…</p>}>
      <Inner />
    </Suspense>
  );
}
