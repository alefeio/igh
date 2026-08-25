"use client";

import { Suspense, useEffect } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";
import { DirectorPeriodControls, useDirectorApiQuery, useFetchJson } from "@/components/diretor/DirectorScopeControls";
import { ChartWithTable, MetricCard } from "@/components/diretor/MetricCard";
import { DirectorDataStamp } from "@/components/diretor/DirectorDataStamp";

type Data = {
  meta: { dataAsOf: string };
  people: {
    activeEmployees: number;
    pendingDocuments: number;
    contractsExpired: number;
    contractsD30: number;
    contractsD60: number;
    contractsD90: number;
    payroll: { status: string | null; pendingLines: number };
    mealTickets: { pending: number; confirmed: number };
  };
  inventory: { belowMin: number; zero: number; stale: number };
  comms: { failedOutbox: number; campaignsWithFailures: number; affectedRecipients: number; oldestFailureAgeDays: number | null };
  charts: {
    contractHorizon: Array<{ bucket: string; count: number }>;
    inventoryCritical: Array<{ category: string; belowMin: number; zero: number }>;
  };
  qualityNotes: string[];
};

function Inner() {
  const qs = useDirectorApiQuery(["competence", "from", "to"]);
  const { data, error, loading, load } = useFetchJson<Data>(`/api/diretor/administrative?${qs}`);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Administrativo"
        title="Pessoas, contratos, estoque e comunicações estão sob controle?"
        rightSlot={<DirectorPeriodControls mode="competence" loading={loading} onRefresh={() => void load()} />}
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {data ? (
        <>
          <DirectorDataStamp dataAsOf={data.meta.dataAsOf} />
          {data.qualityNotes.length > 0 ? <p className="text-sm text-amber-800">{data.qualityNotes.join(" · ")}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Colaboradores ativos" value={data.people.activeEmployees} quality="ok" />
            <MetricCard label="Docs pendentes" value={data.people.pendingDocuments} quality="ok" />
            <MetricCard label="Contratos com vigência encerrada" value={data.people.contractsExpired} quality="ok" />
            <MetricCard label="A vencer 30/60/90" value={`${data.people.contractsD30}/${data.people.contractsD60}/${data.people.contractsD90}`} quality="ok" />
            <MetricCard label="Estoque zerado" value={data.inventory.zero} quality="ok" />
            <MetricCard label="Abaixo do mínimo" value={data.inventory.belowMin} quality="ok" />
            <MetricCard label="Sem movimentação 90d" value={data.inventory.stale} quality="ok" />
            <MetricCard label="Falhas de e-mail" value={data.comms.failedOutbox} quality="ok" />
          </div>
          <p className="text-sm">
            Folha: {data.people.payroll.status ?? "indisponível"} · vale-refeição lançados {data.people.mealTickets.confirmed} / pendentes{" "}
            {data.people.mealTickets.pending}. Destinatários afetados (agregado): {data.comms.affectedRecipients}. Idade da falha mais antiga:{" "}
            {data.comms.oldestFailureAgeDays ?? "n/d"} dia(s).
          </p>
          <ChartWithTable
            title="Vencimentos de contratos — o que vence agora?"
            table={
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Faixa</th>
                    <th>Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {data.charts.contractHorizon.map((r) => (
                    <tr key={r.bucket}>
                      <td>{r.bucket}</td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.charts.contractHorizon}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0369a1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartWithTable>
          <ChartWithTable
            title="Itens críticos de estoque por categoria — há ruptura concentrada?"
            table={
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Abaixo do mín.</th>
                    <th>Zerados</th>
                  </tr>
                </thead>
                <tbody>
                  {data.charts.inventoryCritical.map((r) => (
                    <tr key={r.category}>
                      <td>{r.category}</td>
                      <td>{r.belowMin}</td>
                      <td>{r.zero}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.charts.inventoryCritical}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="belowMin" fill="#b45309" name="Abaixo do mínimo" />
                  <Bar dataKey="zero" fill="#be123c" name="Zerados" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartWithTable>
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
