"use client";

import { useEffect, Suspense } from "react";

import { useFetchJson } from "@/components/diretor/DirectorScopeControls";
import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";

type GuideData = {
  meta: { formulaVersion?: string; dataAsOf: string };
  metrics: Array<{
    metricId: string;
    name: string;
    description: string;
    formula: string;
    numerator: string;
    denominator: string;
    formulaVersion: string;
    period: string;
    qualityNotes: string;
    source: string;
    page: string;
  }>;
  glossary: Array<{ term: string; definition: string }>;
};

function Inner() {
  const { data, error, loading, load } = useFetchJson<GuideData>("/api/diretor/guide");

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Guia do Diretor"
        title="Como interpretar os indicadores"
        description="Explica as leituras da área da Direção. O menu «Como usar o sistema» (outros perfis) ensina a operar o cadastro; este guia interpreta os números executivos."
      />
      {loading && !data ? <p className="text-sm">Carregando…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {data ? (
        <>
          <p className="text-sm text-[var(--text-muted)]">
            Versão das definições: <strong>{data.meta.formulaVersion}</strong>
          </p>
          <section>
            <h2 className="mb-3 text-lg font-bold">Glossário</h2>
            <dl className="space-y-3">
              {data.glossary.map((g) => (
                <div key={g.term} className="rounded-lg border border-[var(--card-border)] p-3">
                  <dt className="font-semibold">{g.term}</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)]">{g.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold">Indicadores</h2>
            <div className="space-y-3">
              {data.metrics.map((m) => (
                <article key={m.metricId} className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-sm">
                  <h3 className="font-bold">{m.name}</h3>
                  <p className="mt-1 text-[var(--text-secondary)]">{m.description}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">Como este indicador é calculado?</summary>
                    <p className="mt-1">{m.formula}</p>
                    <p>Numerador: {m.numerator}</p>
                    <p>Denominador: {m.denominator}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {m.period}
                      {m.qualityNotes ? ` · ${m.qualityNotes}` : ""}
                    </p>
                  </details>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </PanelPageStack>
  );
}

export default function GuiaPage() {
  return (
    <Suspense fallback={<p className="text-sm">Carregando…</p>}>
      <Inner />
    </Suspense>
  );
}
