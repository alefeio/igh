"use client";

import { useEffect, Suspense } from "react";
import Link from "next/link";

import {
  DirectorPeriodControls,
  DirectorScopeControls,
  useDirectorApiQuery,
  useFetchJson,
} from "@/components/diretor/DirectorScopeControls";
import { DataQualityPanel } from "@/components/diretor/DataQualityPanel";
import { MetricCard } from "@/components/diretor/MetricCard";
import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";
import { formatUpdatedAt } from "@/lib/diretor/ui-labels";

type OverviewData = {
  meta: {
    dataAsOf: string;
    generatedAt: string;
    filters: { execCompetence?: string; cycleLabel?: string };
  };
  cycleLabel: string;
  cycles: Array<{ id: string; label: string; isCurrent: boolean }>;
  domainStatus?: Array<{ domain: string; status: string; note?: string }>;
  dataQuality?: Array<{ domain?: string; title?: string; fact?: string; status?: string; note?: string }>;
  kpis: Array<{
    metricId: string;
    label: string;
    value: number | string | null;
    unit?: string;
    formula: string;
    explanation?: string;
    quality: string;
    unavailableReason?: string | null;
    href?: string;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    fact: string;
    suggestedDecision?: string;
    href: string;
    severity: string;
  }>;
};

function OverviewInner() {
  const qs = useDirectorApiQuery(["scope", "cycleId", "execCompetence"]);
  const { data, error, loading, load } = useFetchJson<OverviewData>(`/api/diretor/overview?${qs}`);

  useEffect(() => {
    void load();
  }, [load]);

  const competence = data?.meta.filters.execCompetence;

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Diretoria — Visão Geral"
        title="Como está a instituição agora?"
        description="Indicadores e alertas do recorte escolhido. Ciclo acadêmico e competência financeira são filtros independentes."
        rightSlot={
          <div className="flex flex-col items-end gap-2">
            <DirectorScopeControls cycles={data?.cycles ?? []} loading={loading} onRefresh={() => void load()} />
            <DirectorPeriodControls mode="execCompetence" loading={loading} fallbackMonth={competence} />
          </div>
        }
      />

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading && !data ? <p className="text-sm text-[var(--text-muted)]">Carregando…</p> : null}

      {data ? (
        <>
          <p className="text-sm text-[var(--text-muted)]">
            Recorte: <strong>{data.cycleLabel}</strong>
            {" · "}
            Dados atualizados em {formatUpdatedAt(data.meta.dataAsOf)}
          </p>

          <DataQualityPanel
            items={[
              ...(data.dataQuality ?? []),
              ...(data.domainStatus ?? []).map((d) => ({ domain: d.domain, status: d.status, note: d.note })),
            ]}
          />

          <section aria-label="Indicadores">
            <h2 className="mb-3 text-lg font-bold">Indicadores do recorte</h2>
            {data.kpis.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nenhum indicador calculável neste recorte.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.kpis.map((k) => (
                  <MetricCard key={k.metricId} {...k} />
                ))}
              </div>
            )}
          </section>

          <section aria-label="Alertas críticos">
            <div className="mb-3 flex items-end justify-between gap-2">
              <h2 className="text-lg font-bold">Alertas críticos</h2>
              <Link href="/diretor/prioridades" className="text-sm font-semibold text-[var(--igh-primary)]">
                Ver prioridades →
              </Link>
            </div>
            {data.alerts.length === 0 ? (
              <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                Nenhum alerta crítico neste recorte.
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {data.alerts.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
                  >
                    <p className="font-semibold">{a.title}</p>
                    <p className="mt-1">{a.fact}</p>
                    {a.suggestedDecision ? (
                      <p className="mt-2 text-xs font-medium">Decisão sugerida: {a.suggestedDecision}</p>
                    ) : null}
                    <Link href={a.href} className="mt-2 inline-block text-xs font-semibold underline">
                      Abrir contexto
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </PanelPageStack>
  );
}

export default function DiretorOverviewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--text-muted)]">Carregando…</p>}>
      <OverviewInner />
    </Suspense>
  );
}
