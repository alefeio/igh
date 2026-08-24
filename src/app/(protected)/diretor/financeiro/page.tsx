"use client";

import { Suspense, useEffect, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";
import { DirectorPeriodControls, useDirectorApiQuery, useFetchJson } from "@/components/diretor/DirectorScopeControls";
import { ChartWithTable, MetricCard } from "@/components/diretor/MetricCard";
import { formatCentsBRL } from "@/lib/employees";

type Data = {
  meta: { dataAsOf: string };
  disclaimer: string;
  movement: {
    postedInCents: number;
    postedOutCents: number;
    paidInCents: number;
    paidOutCents: number;
    netPaidCents: number;
  };
  apAr: {
    apCents: number;
    arCents: number;
    openAge91PlusCents?: number;
    aging: Array<{ bucket: string; label?: string; amountCents: number }>;
  };
  byCategory: Array<{ name: string; kind: string; amountCents: number }>;
  byNature: Array<{ nature: string; amountCents: number }>;
  monthlyPaid: Array<{ month: string; paidInCents: number; paidOutCents: number }>;
  payroll: { competence: string | null; status: string | null; pendingLines: number; paidLines: number; incomplete: boolean };
  qualityNotes: string[];
};

function Inner() {
  const qs = useDirectorApiQuery(["competence", "from", "to", "categoryId", "poloId"]);
  const { data, error, loading, load } = useFetchJson<Data>(`/api/diretor/financial?${qs}`);
  useEffect(() => {
    void load();
  }, [load]);

  const line = useMemo(
    () =>
      (data?.monthlyPaid ?? []).map((m) => ({
        month: m.month,
        recebidas: m.paidInCents / 100,
        pagas: m.paidOutCents / 100,
      })),
    [data],
  );

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Financeiro"
        title="Como evoluíram lançamentos e pagamentos?"
        description="Critérios separados: lançamentos por entryDate; pagamentos/recebimentos por paidAt. Sem caixa, saldo ou lucro."
        rightSlot={<DirectorPeriodControls mode="competence" loading={loading} onRefresh={() => void load()} />}
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading && !data ? <p className="text-sm">Carregando…</p> : null}
      {data ? (
        <>
          <p className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm">{data.disclaimer}</p>
          {data.qualityNotes.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
              {data.qualityNotes.join(" · ")}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Receitas lançadas" value={formatCentsBRL(data.movement.postedInCents)} quality="ok" formula="Σ ENTRADA por entryDate" />
            <MetricCard label="Receitas recebidas" value={formatCentsBRL(data.movement.paidInCents)} quality="ok" formula="Σ ENTRADA PAGO por paidAt" />
            <MetricCard label="Despesas lançadas" value={formatCentsBRL(data.movement.postedOutCents)} quality="ok" formula="Σ SAIDA por entryDate" />
            <MetricCard label="Despesas pagas" value={formatCentsBRL(data.movement.paidOutCents)} quality="ok" formula="Σ SAIDA PAGO por paidAt" />
            <MetricCard
              label="Movimentação líquida (pagos)"
              value={formatCentsBRL(data.movement.netPaidCents)}
              quality="ok"
              formula="receitas pagas − despesas pagas"
            />
            <MetricCard label="Lançamentos a pagar em aberto" value={formatCentsBRL(data.apAr.apCents)} quality="ok" />
            <MetricCard label="Lançamentos a receber em aberto" value={formatCentsBRL(data.apAr.arCents)} quality="ok" />
            <MetricCard
              label="Em aberto há mais de 90 dias"
              value={formatCentsBRL(data.apAr.openAge91PlusCents ?? 0)}
              quality="ok"
              formula="idadeEmAberto = dataAsOf − entryDate; não é vencimento"
            />
          </div>
          <ChartWithTable
            title="Receitas recebidas × despesas pagas por mês — a movimentação paga está equilibrada?"
            formula="paidAt no mês"
            table={
              <table className="w-full text-sm">
                <caption className="sr-only">Série mensal de pagos</caption>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Recebidas</th>
                    <th>Pagas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyPaid.map((m) => (
                    <tr key={m.month}>
                      <td>{m.month}</td>
                      <td className="tabular-nums">{formatCentsBRL(m.paidInCents)}</td>
                      <td className="tabular-nums">{formatCentsBRL(m.paidOutCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={line}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="recebidas" stroke="#059669" name="Recebidas (R$)" />
                  <Line dataKey="pagas" stroke="#b45309" name="Pagas (R$)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartWithTable>
          <ChartWithTable
            title="Despesas lançadas por categoria — onde se concentra o gasto registrado?"
            table={
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Natureza</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory.map((c) => (
                    <tr key={`${c.kind}-${c.name}`}>
                      <td>{c.name}</td>
                      <td>{c.kind}</td>
                      <td className="tabular-nums break-all">{formatCentsBRL(c.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data.byCategory.filter((c) => c.kind === "SAIDA").slice(0, 12)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip />
                  <Bar dataKey="amountCents" fill="#0f766e" name="Centavos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartWithTable>
          <p className="text-sm">
            Folha {data.payroll.competence ?? "n/d"}: {data.payroll.status ?? "indisponível"} · pendentes {data.payroll.pendingLines} · pagas{" "}
            {data.payroll.paidLines}
            {data.payroll.incomplete ? " · qualidade parcial" : ""}
          </p>
          <ChartWithTable
            title="Composição das despesas lançadas por natureza — o gasto é mais fixo ou variável?"
            formula="SAIDA por entryDate"
            table={
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Natureza</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byNature.map((n) => (
                    <tr key={n.nature}>
                      <td>{n.nature}</td>
                      <td className="tabular-nums">{formatCentsBRL(n.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.byNature} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="nature" width={110} />
                  <Tooltip />
                  <Bar dataKey="amountCents" fill="#0e7490" name="Centavos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartWithTable>
          <ChartWithTable
            title="Tempo em aberto desde o lançamento — quais registros estão abertos há mais tempo?"
            formula="idadeEmAberto = dataAsOf − entryDate (não é atraso)"
            table={
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Faixa</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.apAr.aging.map((a) => (
                    <tr key={a.bucket}>
                      <td>{a.label ?? a.bucket}</td>
                      <td className="tabular-nums">{formatCentsBRL(a.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data.apAr.aging}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="amountCents" fill="#b45309" name="Centavos" />
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
