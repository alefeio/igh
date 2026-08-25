"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";

import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";
import { DirectorPeriodControls, useDirectorApiQuery, useFetchJson } from "@/components/diretor/DirectorScopeControls";

type Data = {
  notice: string;
  futureModelNote: string;
  annualGoal: { year: number; computersTarget: number; peopleTarget: number; notes: string | null } | null;
  visitsSummary: { count: number; apta: number; inapta: number; pendencias: number };
  donationsContext: { confirmedCount: number; kits: number };
  links: { social: string; financial: string };
  qualityNotes: string[];
};

function Inner() {
  const qs = useDirectorApiQuery(["year"]);
  const { data, error, loading, load } = useFetchJson<Data>(`/api/diretor/projects?${qs}`);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Projetos e Convênios"
        title="Há portfólio institucional acompanhável?"
        rightSlot={<DirectorPeriodControls mode="year" loading={loading} onRefresh={() => void load()} />}
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {data ? (
        <>
          <p className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-4 text-sm font-medium">{data.notice}</p>
          <p className="text-xs text-[var(--text-muted)]">{data.futureModelNote}</p>
          {data.annualGoal ? (
            <section className="rounded-xl border p-4">
              <h3 className="font-bold">Metas institucionais {data.annualGoal.year}</h3>
              <p>Computadores: {data.annualGoal.computersTarget}</p>
              <p>Pessoas (definição própria da meta, não comparada aqui): {data.annualGoal.peopleTarget}</p>
            </section>
          ) : (
            <p className="text-sm">Meta anual indisponível para o ano selecionado — não exibida como zero de projetos.</p>
          )}
          <p className="text-sm">
            Visitas no ano (contexto): {data.visitsSummary.count} · APTA {data.visitsSummary.apta} · pendências {data.visitsSummary.pendencias} · INAPTA{" "}
            {data.visitsSummary.inapta}
          </p>
          <p className="text-sm">
            Doações registradas no ano (contexto, sem tabela completa): {data.donationsContext.confirmedCount} registros · {data.donationsContext.kits} kits.
          </p>
          <p className="text-sm">
            <Link className="underline" href={data.links.social}>
              Impacto Social
            </Link>
            {" · "}
            <Link className="underline" href={data.links.financial}>
              Financeiro
            </Link>
          </p>
        </>
      ) : null}
    </PanelPageStack>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <Inner />
    </Suspense>
  );
}
