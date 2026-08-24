"use client";

import { Suspense, useEffect, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";
import { DirectorPeriodControls, useDirectorApiQuery, useFetchJson } from "@/components/diretor/DirectorScopeControls";
import { ChartWithTable, formatAxisReais, MetricCard } from "@/components/diretor/MetricCard";
import { centsToReais, formatUpdatedAt } from "@/lib/diretor/ui-labels";
import { formatCentsBRL } from "@/lib/employees";

type Data = {
  meta: { dataAsOf: string; filters: { competence?: string } };
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

  const monthly = useMemo(
    () =>
      (data?.monthlyPaid ?? []).map((m) => ({
        month: m.month,
        recebidas: centsToReais(m.paidInCents),
        pagas: centsToReais(m.paidOutCents),
      })),
    [data],
  );
  const categories = useMemo(
    () =>
      (data?.byCategory ?? [])
        .filter((c) => c.kind === "SAIDA")
        .slice(0, 12)
        .map((c) => ({ name: c.name, valor: centsToReais(c.amountCents), amountCents: c.amountCents })),
    [data],
  );
  const natures = useMemo(
    () =>
      (data?.byNature ?? []).map((n) => ({
        nature: n.nature === "FIXA" ? "Fixa" : n.nature === "VARIAVEL" ? "Variável" : n.nature,
        valor: centsToReais(n.amountCents),
        amountCents: n.amountCents,
      })),
    [data],
  );
  const aging = useMemo(
    () =>
      (data?.apAr.aging ?? []).map((a) => ({
        faixa: a.label && !a.label.startsWith("d") ? a.label : a.label ?? a.bucket,
        valor: centsToReais(a.amountCents),
        amountCents: a.amountCents,
      })),
    [data],
  );

  const net = data?.movement.netPaidCents ?? 0;
  const netReading =
    net < 0
      ? `Os pagamentos superaram os recebimentos em ${formatCentsBRL(Math.abs(net))} no período.`
      : net > 0
        ? `Os recebimentos superaram os pagamentos em ${formatCentsBRL(net)} no período.`
        : "Recebimentos e pagamentos se equivalem no período.";

  const useBars = monthly.length < 3;

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Financeiro"
        title="Como evoluíram lançamentos e pagamentos?"
        description="Lançamentos usam a data do registro; pagamentos, a data em que foram pagos. Isso não é saldo bancário."
        rightSlot={
          <DirectorPeriodControls
            mode="competence"
            loading={loading}
            onRefresh={() => void load()}
            fallbackMonth={data?.meta.filters.competence}
          />
        }
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading && !data ? <p className="text-sm">Carregando…</p> : null}
      {data ? (
        <>
          <p className="text-sm text-[var(--text-muted)]">Dados atualizados em {formatUpdatedAt(data.meta.dataAsOf)}</p>
          <p className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm">{data.disclaimer}</p>
          {data.qualityNotes.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">{data.qualityNotes.join(" · ")}</div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Receitas lançadas"
              value={formatCentsBRL(data.movement.postedInCents)}
              quality="ok"
              explanation="Soma das receitas pela data em que o lançamento foi registrado."
            />
            <MetricCard
              label="Receitas recebidas"
              value={formatCentsBRL(data.movement.paidInCents)}
              quality="ok"
              explanation="Soma das receitas pela data em que o valor foi recebido."
            />
            <MetricCard
              label="Despesas lançadas"
              value={formatCentsBRL(data.movement.postedOutCents)}
              quality="ok"
              explanation="Soma das despesas pela data em que o lançamento foi registrado."
            />
            <MetricCard
              label="Despesas pagas"
              value={formatCentsBRL(data.movement.paidOutCents)}
              quality="ok"
              explanation="Soma das despesas pela data em que o valor foi pago."
            />
            <MetricCard
              label="Movimentação líquida (pagos)"
              value={formatCentsBRL(data.movement.netPaidCents)}
              quality="ok"
              explanation={`${netReading} Isso não representa saldo bancário.`}
            />
            <MetricCard label="Lançamentos a pagar em aberto" value={formatCentsBRL(data.apAr.apCents)} quality="ok" />
            <MetricCard label="Lançamentos a receber em aberto" value={formatCentsBRL(data.apAr.arCents)} quality="ok" />
            <MetricCard
              label="Em aberto há mais de 90 dias"
              value={formatCentsBRL(data.apAr.openAge91PlusCents ?? 0)}
              quality="ok"
              explanation="Tempo desde a data do lançamento até hoje. Não é vencimento nem atraso contratual."
            />
          </div>
          <ChartWithTable
            title="Receitas recebidas × despesas pagas por mês — a movimentação paga está equilibrada?"
            description={useBars ? "Com menos de três competências, as barras comparam recebidas e pagas no período disponível." : undefined}
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
            <div className="h-64 min-w-[520px] sm:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                {useBars ? (
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={formatAxisReais} tick={{ fontSize: 12 }} width={88} />
                    <Tooltip formatter={(v) => formatAxisReais(Number(v))} />
                    <Legend />
                    <Bar dataKey="recebidas" fill="#059669" name="Recebidas" />
                    <Bar dataKey="pagas" fill="#b45309" name="Pagas" />
                  </BarChart>
                ) : (
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={formatAxisReais} tick={{ fontSize: 12 }} width={88} />
                    <Tooltip formatter={(v) => formatAxisReais(Number(v))} />
                    <Legend />
                    <Line dataKey="recebidas" stroke="#059669" name="Recebidas" />
                    <Line dataKey="pagas" stroke="#b45309" name="Pagas" />
                  </LineChart>
                )}
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
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory
                    .filter((c) => c.kind === "SAIDA")
                    .map((c) => (
                      <tr key={`${c.kind}-${c.name}`}>
                        <td>{c.name}</td>
                        <td className="tabular-nums">{formatCentsBRL(c.amountCents)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            }
          >
            <div className="h-64 min-w-[520px] sm:min-w-0">
              <ResponsiveContainer>
                <BarChart data={categories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatAxisReais} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatAxisReais(Number(v))} />
                  <Bar dataKey="valor" fill="#0f766e" name="Valor" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartWithTable>
          <p className="text-sm">
            Folha {data.payroll.competence ?? "sem competência"}: {data.payroll.status ?? "indisponível"} · pendentes{" "}
            {data.payroll.pendingLines} · pagas {data.payroll.paidLines}
            {data.payroll.incomplete ? " · leitura provisória da folha" : ""}
          </p>
          <ChartWithTable
            title="Composição das despesas lançadas por natureza — o gasto é mais fixo ou variável?"
            table={
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Natureza</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {natures.map((n) => (
                    <tr key={n.nature}>
                      <td>{n.nature}</td>
                      <td className="tabular-nums">{formatCentsBRL(n.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-56 min-w-[520px] sm:min-w-0">
              <ResponsiveContainer>
                <BarChart data={natures} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatAxisReais} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="nature" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatAxisReais(Number(v))} />
                  <Bar dataKey="valor" fill="#0e7490" name="Valor" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartWithTable>
          <ChartWithTable
            title="Tempo em aberto desde o lançamento — quais registros estão abertos há mais tempo?"
            description="Faixas medem há quanto tempo o lançamento está aberto. Não indicam vencimento."
            table={
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Faixa</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.map((a) => (
                    <tr key={a.faixa}>
                      <td>{a.faixa}</td>
                      <td className="tabular-nums">{formatCentsBRL(a.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-56 min-w-[520px] sm:min-w-0">
              <ResponsiveContainer>
                <BarChart data={aging}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis tickFormatter={formatAxisReais} tick={{ fontSize: 12 }} width={88} />
                    <Tooltip formatter={(v) => formatAxisReais(Number(v))} />
                  <Bar dataKey="valor" fill="#b45309" name="Valor" />
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
