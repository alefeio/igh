"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Suspense } from "react";

import {
  DirectorPeriodControls,
  DirectorScopeControls,
  useDirectorApiQuery,
  useFetchJson,
} from "@/components/diretor/DirectorScopeControls";
import { MetricCard } from "@/components/diretor/MetricCard";
import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";

type OverviewData = {
  meta: {
    dataAsOf: string;
    generatedAt: string;
    quality: Array<{ domain: string; status: string; note?: string }>;
    filters: { execCompetence?: string; cycleLabel?: string };
  };
  cycleLabel: string;
  cycles: Array<{ id: string; label: string; isCurrent: boolean }>;
  domainStatus?: Array<{ domain: string; status: string; note?: string }>;
  kpis: Array<{
    metricId: string;
    label: string;
    value: number | string | null;
    unit?: string;
    formula: string;
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
  qualityNotes: string[];
  links: Record<string, string>;
};

function OverviewInner() {
  const qs = useDirectorApiQuery(["scope", "cycleId", "execCompetence"]);
  const { data, error, loading, load } = useFetchJson<OverviewData>(
    `/api/diretor/overview?${qs}`,
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Diretoria — Visão Geral"
        title="Como está a instituição agora?"
        description="Até seis indicadores e cinco alertas. Ciclo acadêmico e competência financeira são filtros independentes. O painel legado em /dashboard permanece até autorização do redirect."
        rightSlot={
          <div className="flex flex-col items-end gap-2">
            <DirectorScopeControls
              cycles={data?.cycles ?? []}
              loading={loading}
              onRefresh={() => void load()}
            />
            <DirectorPeriodControls mode="execCompetence" loading={loading} />
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
            dataAsOf{" "}
            {new Date(data.meta.dataAsOf).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" · "}
            gerado{" "}
            {new Date(data.meta.generatedAt).toLocaleString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          {data.qualityNotes.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <strong>Qualidade dos dados:</strong>
              <ul className="mt-1 list-disc pl-5">
                {data.qualityNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.domainStatus && data.domainStatus.some((d) => d.status !== "ok") ? (
            <p className="text-xs text-[var(--text-muted)]">
              Falha parcial:{" "}
              {data.domainStatus
                .filter((d) => d.status !== "ok")
                .map((d) => `${d.domain} (${d.status})`)
                .join(" · ")}
            </p>
          ) : null}

          <nav className="flex flex-wrap gap-2 text-sm" aria-label="Páginas temáticas">
            {Object.entries(data.links)
              .filter(([k]) => k !== "legacyDashboard")
              .map(([k, href]) => (
                <Link key={k} href={href} className="rounded-md border border-[var(--card-border)] px-2 py-1">
                  {k}
                </Link>
              ))}
          </nav>

          <section aria-label="KPIs">
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
              <Link href={data.links.priorities} className="text-sm font-semibold text-[var(--igh-primary)]">
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
