"use client";

import { Suspense, useEffect } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";
import { DirectorPeriodControls, DirectorScopeControls, useDirectorApiQuery, useFetchJson } from "@/components/diretor/DirectorScopeControls";
import { ChartWithTable, MetricCard } from "@/components/diretor/MetricCard";
import { DirectorDataStamp } from "@/components/diretor/DirectorDataStamp";

type Data = {
  meta: { dataAsOf: string; filters: { cycleLabel?: string; from?: string; to?: string; periodPreset?: string } };
  disclaimerLongTerm: string;
  peopleGoalNote: string;
  territoryNote?: string;
  callCompletenessRate?: number | null;
  reach: {
    enrolledUnique: number;
    servedUnique: number;
    newServed: number;
    recurrentServed: number;
    completersUnique: number;
    certificatesIssued: number;
    territories: Array<{ name: string; served: number | string }>;
  };
  donations: {
    computersDonated: number;
    computersTarget: number | null;
    computersProgressPct: number | null;
    donatarias: number;
    visits: number;
  };
  charts: {
    newVsRecurrent: Array<{ tipo: string; valor: number }>;
    computers: Array<{ label: string; valor: number }>;
    visitsByClass: Array<{ classification: string; count: number }>;
  };
  qualityNotes: string[];
};

function Inner() {
  const qs = useDirectorApiQuery(["from", "to", "cycleId", "poloId", "courseId"]);
  const { data, error, loading, load } = useFetchJson<Data>(`/api/diretor/social-impact?${qs}`);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Impacto Social"
        title="Qual o alcance e as entregas no período?"
        description="Alcance, entregas e produtos no período. Não mede causalidade de impacto. Alunos e instituições donatárias não são somados."
        rightSlot={
          <div className="flex flex-col gap-2">
            <DirectorPeriodControls
              mode="range"
              loading={loading}
              onRefresh={() => void load()}
              fallbackFrom={data?.meta.filters.from}
              fallbackTo={data?.meta.filters.to}
            />
            <DirectorScopeControls cycles={[]} loading={loading} />
          </div>
        }
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {data ? (
        <>
          <DirectorDataStamp dataAsOf={data.meta.dataAsOf} />
          <p className="text-sm text-[var(--text-muted)]">
            Período dos novos e recorrentes: {data.meta.filters.periodPreset ?? "Ano atual"} (
            {data.meta.filters.from ?? "—"} → {data.meta.filters.to ?? "—"}).
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Atendidos únicos usam o ciclo acadêmico e a mesma regra da Visão Geral e do Acadêmico. Novos e recorrentes
            usam o período de calendário selecionado — não compare esses totais como se fossem o mesmo recorte.
          </p>
          <p className="rounded-lg border px-4 py-3 text-sm">{data.disclaimerLongTerm}</p>
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">{data.peopleGoalNote}</p>
          {data.territoryNote ? (
            <p className="rounded-lg border px-4 py-3 text-sm">{data.territoryNote}</p>
          ) : null}
          {(() => {
            const presencePartial =
              data.callCompletenessRate != null && data.callCompletenessRate < 90;
            const completeness =
              data.callCompletenessRate != null ? `${data.callCompletenessRate}% das chamadas preenchidas` : null;
            const pq = presencePartial ? "partial" : "ok";
            return (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Pessoas únicas com matrícula"
              value={data.reach.enrolledUnique}
              quality="ok"
              explanation="Pessoas distintas com matrícula no recorte."
            />
            <MetricCard
              label="Atendidos únicos (ciclo acadêmico)"
              value={
                presencePartial
                  ? `${data.reach.servedUnique.toLocaleString("pt-BR")} alunos com presença registrada`
                  : data.reach.servedUnique
              }
              quality={pq}
              explanation={
                presencePartial
                  ? `Ao menos ${data.reach.servedUnique.toLocaleString("pt-BR")} alunos atendidos nos registros disponíveis. ${completeness ?? ""} Não é alcance definitivo.`
                  : "Pessoas distintas com presença no ciclo — mesma função da Visão Geral e do Acadêmico."
              }
            />
            <MetricCard
              label="Novos atendidos (período de calendário)"
              value={data.reach.newServed}
              quality={pq}
              explanation="Primeira presença no intervalo de datas selecionado. Recorte diferente do total do ciclo."
            />
            <MetricCard
              label="Recorrentes (período de calendário)"
              value={data.reach.recurrentServed}
              quality={pq}
              explanation="Já haviam sido atendidos antes do intervalo de datas selecionado."
            />
            <MetricCard label="Concluintes únicos" value={data.reach.completersUnique} quality={pq} />
            <MetricCard label="Certificados emitidos" value={data.reach.certificatesIssued} quality="ok" />
            <MetricCard label="Equipamentos doados" value={data.donations.computersDonated} quality="ok" />
            <MetricCard
              label="Meta de computadores"
              value={data.donations.computersTarget ?? "Indisponível"}
              quality={data.donations.computersTarget == null ? "unavailable" : "ok"}
            />
            <MetricCard
              label="% meta computadores"
              value={data.donations.computersProgressPct}
              unit="%"
              quality={data.donations.computersProgressPct == null ? "unavailable" : "ok"}
            />
            <MetricCard label="Instituições donatárias" value={data.donations.donatarias} quality="ok" />
            <MetricCard label="Visitas técnicas" value={data.donations.visits} quality="ok" />
          </div>
            );
          })()}
          <ChartWithTable
            title="Novos × recorrentes — o atendimento é de entrada ou de continuidade?"
            table={
              <table className="w-full text-sm">
                <tbody>
                  {data.charts.newVsRecurrent.map((r) => (
                    <tr key={r.tipo}>
                      <td>{r.tipo}</td>
                      <td>{r.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={data.charts.newVsRecurrent}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tipo" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="valor" fill="#047857" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartWithTable>
          <section>
            <h3 className="font-bold">Alcance por território (LGPD)</h3>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Território</th>
                  <th>Atendidos</th>
                </tr>
              </thead>
              <tbody>
                {data.reach.territories.map((t) => (
                  <tr key={t.name}>
                    <td>{t.name}</td>
                    <td>{t.served}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
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
