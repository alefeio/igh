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

type AcademicData = {
  meta: { dataAsOf: string };
  cycleLabel: string;
  cycles: Array<{ id: string; label: string; isCurrent: boolean }>;
  academic: {
    funnel: {
      preEnrollments: number;
      confirmed: number;
      started: number;
      completedStarted: number | null;
      completionStartedRate: number | null;
      nonStartRateAmongConfirmed: number | null;
      cancelAfterStartUntyped: number;
    };
    attendance: {
      opportunities: number;
      presentCount: number;
      justifiedCount: number;
      unjustifiedCount: number;
      presentRate: number | null;
      justifiedRate: number | null;
      unjustifiedRate: number | null;
    };
    suspensions: number;
    criticalAbsenceRisk: number;
    servedUnique: number;
    byCourse: Array<{
      courseId: string;
      courseName: string;
      occupancyPercent: number | null;
      occupied: number;
      capacity: number;
    }>;
  };
  metrics: Record<string, { formula: string; name: string } | undefined>;
  qualityNotes: string[];
};

function Inner() {
  const qs = useDirectorApiQuery();
  const { data, error, loading, load } = useFetchJson<AcademicData>(
    `/api/diretor/academic?${qs}`,
  );

  useEffect(() => {
    void load();
  }, [load]);

  const funnelChart = useMemo(() => {
    if (!data) return [];
    const f = data.academic.funnel;
    return [
      { etapa: "Pré-matrículas", valor: f.preEnrollments },
      { etapa: "Confirmadas", valor: f.confirmed },
      { etapa: "Iniciaram", valor: f.started },
      {
        etapa: "Concluíram (encerradas)",
        valor: f.completedStarted ?? 0,
      },
    ];
  }, [data]);

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Acadêmico"
        title="Os alunos entram, frequentam e concluem?"
        description="Frequência usa oportunidades aluno×sessão (LIBERADA). Risco crítico por faltas ≠ evasão confirmada."
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
          {data.qualityNotes.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
              {data.qualityNotes.join(" · ")}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Risco crítico por faltas"
              value={data.academic.criticalAbsenceRisk}
              formula={data.metrics.criticalAbsences?.formula}
              quality="ok"
            />
            <MetricCard
              label="Frequência (presença)"
              value={data.academic.attendance.presentRate}
              unit="%"
              formula={data.metrics.present?.formula}
              quality={data.academic.attendance.presentRate == null ? "unavailable" : "ok"}
              unavailableReason={
                data.academic.attendance.presentRate == null
                  ? "Sem oportunidades elegíveis"
                  : null
              }
            />
            <MetricCard
              label="Suspensos"
              value={data.academic.suspensions}
              formula="count(SUSPENDED)"
              quality="ok"
            />
            <MetricCard
              label="Atendidos únicos"
              value={data.academic.servedUnique}
              formula={data.metrics.served?.formula}
              quality="ok"
            />
            <MetricCard
              label="Conclusão (quem iniciou)"
              value={data.academic.funnel.completionStartedRate}
              unit="%"
              formula={data.metrics.completion?.formula}
              quality={
                data.academic.funnel.completionStartedRate == null ? "unavailable" : "ok"
              }
              unavailableReason={
                data.academic.funnel.completionStartedRate == null
                  ? "Sem coorte encerrada/madura no recorte"
                  : null
              }
            />
            <MetricCard
              label="Não início (confirmados)"
              value={data.academic.funnel.nonStartRateAmongConfirmed}
              unit="%"
              formula="confirmados sem presença ÷ confirmados"
              quality={
                data.academic.funnel.nonStartRateAmongConfirmed == null
                  ? "unavailable"
                  : "ok"
              }
              unavailableReason={
                data.academic.funnel.nonStartRateAmongConfirmed == null
                  ? "Sem confirmados"
                  : null
              }
            />
            <MetricCard
              label="Cancel. após início (não tipado)"
              value={data.academic.funnel.cancelAfterStartUntyped}
              formula={data.metrics.cancelUntyped?.formula}
              quality="partial"
            />
            <MetricCard
              label="Faltas não justificadas"
              value={data.academic.attendance.unjustifiedRate}
              unit="%"
              formula={data.metrics.unjustified?.formula}
              quality={data.academic.attendance.unjustifiedRate == null ? "unavailable" : "ok"}
              unavailableReason={
                data.academic.attendance.unjustifiedRate == null
                  ? "Sem oportunidades elegíveis"
                  : null
              }
            />
          </div>

          <ChartWithTable
            title="Funil da jornada no recorte — pré-matrícula até conclusão em turmas encerradas"
            description="Conclusão final só é interpretável nas barras de turmas encerradas; turmas em andamento não geram taxa final."
            formula="etapas agregadas do recorte"
            table={
              <table className="mt-2 w-full text-left text-sm">
                <caption className="sr-only">Tabela do funil acadêmico</caption>
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelChart.map((r) => (
                    <tr key={r.etapa}>
                      <td>{r.etapa}</td>
                      <td>{r.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="etapa" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="valor" name="Quantidade" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartWithTable>
        </>
      ) : null}
    </PanelPageStack>
  );
}

export default function AcademicoPage() {
  return (
    <Suspense fallback={<p className="text-sm">Carregando…</p>}>
      <Inner />
    </Suspense>
  );
}
