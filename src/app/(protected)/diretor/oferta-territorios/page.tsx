"use client";

import { useEffect, Suspense, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  DirectorScopeControls,
  useDirectorApiQuery,
  useFetchJson,
} from "@/components/diretor/DirectorScopeControls";
import { ChartWithTable, MetricCard } from "@/components/diretor/MetricCard";
import { DashboardHero, PanelPageStack } from "@/components/dashboard/DashboardUI";

type OfferData = {
  meta: { dataAsOf: string };
  cycleLabel: string;
  cycles: Array<{ id: string; label: string; isCurrent: boolean }>;
  note: string;
  offer: {
    capacity: number;
    occupied: number;
    occupancyPercent: number | null;
    emptyClasses: number;
    below30: number;
    ge80: number;
    full: number;
    waitlist: number;
    demandUniqueCount: number;
    seatOffers: {
      pending: number;
      accepted: number;
      expired: number;
      cancelled: number;
      acceptRate: number | null;
    };
    territories: Array<{
      name: string;
      occupancyPercent: number | null;
      occupied: number;
      capacity: number;
      turmas: number;
    }>;
    byCourse: Array<{
      courseName: string;
      occupied: number;
      capacity: number;
      waitlist: number;
      occupancyPercent: number | null;
    }>;
  };
  metrics: Record<string, { formula: string } | undefined>;
};

function Inner() {
  const qs = useDirectorApiQuery();
  const { data, error, loading, load } = useFetchJson<OfferData>(
    `/api/diretor/offer-territories?${qs}`,
  );

  useEffect(() => {
    void load();
  }, [load]);

  const territoryChart = useMemo(() => {
    if (!data) return [];
    return data.offer.territories.slice(0, 12).map((t) => ({
      name: t.name.length > 22 ? `${t.name.slice(0, 20)}…` : t.name,
      ocupacao: t.occupancyPercent ?? 0,
    }));
  }, [data]);

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Oferta e Territórios"
        title="Onde há demanda e o que revisar?"
        description="Ocupação atual, waitlist e ofertas de vaga. Ocupação inicial não entra como KPI principal nesta fase."
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
            Recorte: <strong>{data.cycleLabel}</strong> · dataAsOf{" "}
            {new Date(data.meta.dataAsOf).toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{data.note}</p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Ocupação atual"
              value={data.offer.occupancyPercent}
              unit="%"
              formula={data.metrics.occupancy?.formula}
              quality={data.offer.occupancyPercent == null ? "unavailable" : "ok"}
              unavailableReason={
                data.offer.occupancyPercent == null ? "Sem capacidade" : null
              }
            />
            <MetricCard
              label="Lista de espera"
              value={data.offer.waitlist}
              formula={data.metrics.waitlist?.formula}
              quality="ok"
            />
            <MetricCard
              label="Demanda única (pré ∪ waitlist)"
              value={data.offer.demandUniqueCount}
              formula="studentIds distintos em pré-matrícula ∪ waitlist WAITING"
              quality="ok"
            />
            <MetricCard
              label="Aceite de ofertas de vaga"
              value={data.offer.seatOffers.acceptRate}
              unit="%"
              formula={data.metrics.acceptRate?.formula}
              quality={data.offer.seatOffers.acceptRate == null ? "unavailable" : "ok"}
              unavailableReason={
                data.offer.seatOffers.acceptRate == null
                  ? "Sem ofertas decididas"
                  : null
              }
            />
            <MetricCard
              label="Turmas ocupação crítica"
              value={data.offer.emptyClasses + data.offer.below30}
              formula={data.metrics.lowOccupancy?.formula}
              quality="ok"
            />
          </div>

          <ChartWithTable
            title="Ocupação atual por território — onde a vaga está preenchida"
            description="Comparação entre polos/locais do recorte (ocupação atual)."
            formula="ocupantes ÷ capacidade"
            table={
              <table className="mt-2 w-full text-left text-sm">
                <caption className="sr-only">Ocupação por território</caption>
                <thead>
                  <tr>
                    <th>Território</th>
                    <th>Ocupação</th>
                    <th>Ocupantes</th>
                    <th>Capacidade</th>
                    <th>Turmas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.offer.territories.map((t) => (
                    <tr key={t.name}>
                      <td>{t.name}</td>
                      <td>
                        {t.occupancyPercent != null ? `${t.occupancyPercent}%` : "Indisponível"}
                      </td>
                      <td>{t.occupied}</td>
                      <td>{t.capacity}</td>
                      <td>{t.turmas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={territoryChart} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="ocupacao" name="Ocupação %" fill="#059669" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartWithTable>

          <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
            <h3 className="font-bold">Demanda por curso (ocupação e espera)</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Quadrantes demanda × conclusão ficam no Acadêmico: este loader não consulta frequência.
            </p>
            <table className="mt-3 w-full text-left text-sm">
              <caption className="sr-only">Demanda por curso</caption>
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Ocupação</th>
                  <th>Espera</th>
                </tr>
              </thead>
              <tbody>
                {(data.offer.byCourse ?? []).map((r) => (
                  <tr key={r.courseName}>
                    <td>{r.courseName}</td>
                    <td>{r.occupancyPercent != null ? `${r.occupancyPercent}%` : "Indisponível"}</td>
                    <td>{r.waitlist}</td>
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

export default function OfertaPage() {
  return (
    <Suspense fallback={<p className="text-sm">Carregando…</p>}>
      <Inner />
    </Suspense>
  );
}
