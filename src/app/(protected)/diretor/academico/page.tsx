"use client";

import { useEffect, Suspense, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { formatUpdatedAt } from "@/lib/diretor/ui-labels";

type AcademicData = {
  meta: { dataAsOf: string };
  cycleLabel: string;
  cycles: Array<{ id: string; label: string; isCurrent: boolean }>;
  academic: {
    funnel: {
      preEnrollments: number;
      confirmed: number;
      started: number;
      startedAmongConfirmed?: number;
      confirmedNotStarted?: number;
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
      unmarkedCount: number;
      callCompletenessRate: number | null;
      presentRate: number | null;
      justifiedRate: number | null;
      unjustifiedRate: number | null;
      quality?: string;
      executiveReliable?: boolean;
    };
    suspensions: number;
    criticalAbsenceRisk: number;
    servedUnique: number;
  };
  qualityNotes: string[];
};

function Inner() {
  const qs = useDirectorApiQuery();
  const { data, error, loading, load } = useFetchJson<AcademicData>(`/api/diretor/academic?${qs}`);

  useEffect(() => {
    void load();
  }, [load]);

  const f = data?.academic.funnel;
  const startedAmong = f?.startedAmongConfirmed ?? f?.started ?? 0;
  const journeyChart = useMemo(() => {
    if (!f) return [];
    return [
      { etapa: "Confirmadas", valor: f.confirmed },
      { etapa: "Iniciaram", valor: f.startedAmongConfirmed ?? f.started },
      ...(f.completedStarted == null ? [] : [{ etapa: "Concluíram (turmas encerradas)", valor: f.completedStarted }]),
    ];
  }, [f]);

  const att = data?.academic.attendance;
  const attendanceProvisional = att?.executiveReliable === false;
  const attendanceLabel = attendanceProvisional
    ? `Frequência provisória: ${att?.presentRate ?? "—"}% — apenas ${att?.callCompletenessRate ?? "—"}% das chamadas estão completas`
    : "Frequência (presença)";

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Acadêmico"
        title="Os alunos entram, frequentam e concluem?"
        description="Frequência considera aulas já liberadas. Risco por faltas consecutivas não é evasão confirmada."
        rightSlot={
          <DirectorScopeControls cycles={data?.cycles ?? []} loading={loading} onRefresh={() => void load()} />
        }
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {data ? (
        <>
          <p className="text-sm text-[var(--text-muted)]">
            Recorte: <strong>{data.cycleLabel}</strong> · Dados atualizados em {formatUpdatedAt(data.meta.dataAsOf)}
          </p>
          {data.qualityNotes.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">{data.qualityNotes.join(" · ")}</div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Risco crítico por faltas"
              value={data.academic.criticalAbsenceRisk}
              explanation="Matrículas ativas ou suspensas com quatro ou mais faltas consecutivas sem justificativa."
              quality="ok"
            />
            <MetricCard
              label={attendanceLabel}
              value={attendanceProvisional ? att?.presentRate ?? null : att?.presentRate ?? null}
              unit="%"
              explanation={
                attendanceProvisional
                  ? "Valor preliminar. Abaixo de 90% de completude da chamada, a frequência não deve ser lida como institucional definitiva."
                  : "Presenças sobre as oportunidades de aula já liberadas no recorte."
              }
              quality={attendanceProvisional ? "partial" : att?.presentRate == null ? "unavailable" : "ok"}
              unavailableReason={att?.presentRate == null ? "Sem aulas elegíveis no recorte" : null}
            />
            <MetricCard
              label="Completude da chamada"
              value={att?.callCompletenessRate ?? null}
              unit="%"
              explanation="Percentual de oportunidades de aula com lançamento de presença."
              quality={(att?.unmarkedCount ?? 0) > 0 ? "partial" : att?.callCompletenessRate == null ? "unavailable" : "ok"}
              unavailableReason={att?.callCompletenessRate == null ? "Sem aulas elegíveis no recorte" : null}
            />
            <MetricCard
              label="Suspensos"
              value={data.academic.suspensions}
              explanation="Matrículas com situação suspensa no recorte."
              quality="ok"
            />
            <MetricCard
              label="Atendidos únicos"
              value={data.academic.servedUnique}
              explanation="Pessoas distintas com pelo menos uma presença em aula no recorte."
              quality="ok"
            />
            <MetricCard
              label="Conclusão (quem iniciou)"
              value={data.academic.funnel.completionStartedRate}
              unit="%"
              explanation="Entre quem já frequentou, em turmas encerradas."
              quality={data.academic.funnel.completionStartedRate == null ? "unavailable" : "ok"}
              unavailableReason={
                data.academic.funnel.completionStartedRate == null ? "Sem coorte encerrada no recorte" : null
              }
            />
            <MetricCard
              label="Não início (confirmados)"
              value={data.academic.funnel.nonStartRateAmongConfirmed}
              unit="%"
              explanation={`Confirmados ${f?.confirmed ?? 0} − iniciaram ${startedAmong} = não iniciaram ${f?.confirmedNotStarted ?? Math.max(0, (f?.confirmed ?? 0) - startedAmong)}. Taxa = não iniciaram ÷ confirmados.`}
              quality={data.academic.funnel.nonStartRateAmongConfirmed == null ? "unavailable" : "ok"}
              unavailableReason={data.academic.funnel.nonStartRateAmongConfirmed == null ? "Sem confirmados" : null}
            />
            <MetricCard
              label="Cancelamentos após o início"
              value={data.academic.funnel.cancelAfterStartUntyped}
              explanation="Matrículas canceladas depois de o aluno já ter frequentado, ainda sem motivo estruturado."
              quality="partial"
            />
            <MetricCard
              label="Faltas não justificadas"
              value={att?.unjustifiedRate ?? null}
              unit="%"
              explanation="Faltas sem justificativa sobre as oportunidades de aula já liberadas."
              quality={att?.unjustifiedRate == null ? "unavailable" : "ok"}
              unavailableReason={att?.unjustifiedRate == null ? "Sem aulas elegíveis no recorte" : null}
            />
            <MetricCard
              label="Pré-matrículas atuais"
              value={data.academic.funnel.preEnrollments}
              explanation="Estoque atual de pré-matrículas. Não faz parte da mesma coorte acumulada das confirmadas."
              quality="ok"
            />
          </div>

          <ChartWithTable
            title="Situação da jornada no recorte"
            description="As barras de confirmadas e iniciaram usam a mesma coorte de matrículas confirmadas. Pré-matrículas são estoque atual e não entram neste gráfico, para não sugerir conversão entre medidas de naturezas diferentes."
            table={
              <table className="mt-2 w-full text-left text-sm">
                <caption className="sr-only">Situação da jornada</caption>
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {journeyChart.map((row) => (
                    <tr key={row.etapa}>
                      <td>{row.etapa}</td>
                      <td>{row.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={journeyChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="etapa" tick={{ fontSize: 12 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="valor" name="Pessoas / matrículas" fill="#0284c7" radius={[4, 4, 0, 0]} />
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
