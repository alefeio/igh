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
import { DirectorDataStamp } from "@/components/diretor/DirectorDataStamp";

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
      attendanceReliable?: boolean;
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
  const completenessLabel =
    att?.callCompletenessRate != null ? `${att.callCompletenessRate}% das chamadas preenchidas` : null;

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
            Recorte: <strong>{data.cycleLabel}</strong>
          </p>
          <DirectorDataStamp dataAsOf={data.meta.dataAsOf} />
          {attendanceProvisional && completenessLabel ? (
            <p className="text-sm text-amber-800 dark:text-amber-300">{completenessLabel}</p>
          ) : null}
          {data.qualityNotes.length > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">{data.qualityNotes.join(" · ")}</div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Risco crítico por faltas"
              value={data.academic.criticalAbsenceRisk}
              explanation={
                attendanceProvisional
                  ? `Casos identificados nos registros disponíveis — leitura parcial. ${completenessLabel ?? ""}`
                  : "Matrículas ativas ou suspensas com quatro ou mais faltas consecutivas sem justificativa, sem sessão desconhecida entre elas."
              }
              quality={attendanceProvisional ? "partial" : "ok"}
            />
            <MetricCard
              label={attendanceProvisional ? "Frequência provisória" : "Frequência (presença)"}
              value={att?.presentRate ?? null}
              unit="%"
              explanation={
                attendanceProvisional
                  ? `${completenessLabel ?? "Chamadas incompletas"}. Valor preliminar: não use para meta, ranking nem síntese conclusiva. Oportunidades sem lançamento permanecem desconhecidas, não são faltas.`
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
              value={
                attendanceProvisional
                  ? `${data.academic.servedUnique.toLocaleString("pt-BR")} alunos com presença registrada`
                  : data.academic.servedUnique
              }
              explanation={
                attendanceProvisional
                  ? `Ao menos ${data.academic.servedUnique.toLocaleString("pt-BR")} alunos atendidos nos registros disponíveis. ${completenessLabel ?? ""} Leitura parcial — não é alcance institucional definitivo.`
                  : "Pessoas distintas com pelo menos uma presença em aula no recorte."
              }
              quality={attendanceProvisional ? "partial" : "ok"}
            />
            <MetricCard
              label="Conclusão (quem iniciou)"
              value={data.academic.funnel.completionStartedRate}
              unit="%"
              explanation={
                attendanceProvisional
                  ? `Entre quem já frequentou, em turmas encerradas. ${completenessLabel ?? ""} Leitura parcial.`
                  : "Entre quem já frequentou, em turmas encerradas."
              }
              quality={
                data.academic.funnel.completionStartedRate == null
                  ? "unavailable"
                  : attendanceProvisional
                    ? "partial"
                    : "ok"
              }
              unavailableReason={
                data.academic.funnel.completionStartedRate == null ? "Sem coorte encerrada no recorte" : null
              }
            />
            <MetricCard
              label={attendanceProvisional ? "Início ainda não comprovado nos registros" : "Não início (confirmados)"}
              value={data.academic.funnel.nonStartRateAmongConfirmed}
              unit="%"
              explanation={
                attendanceProvisional
                  ? `Confirmadas ${f?.confirmed ?? 0}; iniciaram com presença registrada ${startedAmong}; sem início comprovado ${f?.confirmedNotStarted ?? Math.max(0, (f?.confirmed ?? 0) - startedAmong)}. Percentual provisório. Este percentual pode diminuir após a regularização das chamadas. Não use para alerta executivo, comparação de desempenho ou conclusão sobre abandono.`
                  : `Confirmados ${f?.confirmed ?? 0} − iniciaram ${startedAmong} = não iniciaram ${f?.confirmedNotStarted ?? Math.max(0, (f?.confirmed ?? 0) - startedAmong)}. Taxa = não iniciaram ÷ confirmados.`
              }
              quality={
                data.academic.funnel.nonStartRateAmongConfirmed == null
                  ? "unavailable"
                  : attendanceProvisional
                    ? "partial"
                    : "ok"
              }
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
              explanation={
                attendanceProvisional
                  ? `Leitura provisória. ${completenessLabel ?? ""}. Não use para comparação ou alerta conclusivo.`
                  : "Faltas sem justificativa sobre as oportunidades de aula já liberadas."
              }
              quality={att?.unjustifiedRate == null ? "unavailable" : attendanceProvisional ? "partial" : "ok"}
              unavailableReason={att?.unjustifiedRate == null ? "Sem aulas elegíveis no recorte" : null}
            />
            <MetricCard
              label="Faltas justificadas"
              value={att?.justifiedRate ?? null}
              unit="%"
              explanation={
                attendanceProvisional
                  ? `Leitura provisória. ${completenessLabel ?? ""}.`
                  : "Faltas justificadas sobre as oportunidades de aula já liberadas."
              }
              quality={att?.justifiedRate == null ? "unavailable" : attendanceProvisional ? "partial" : "ok"}
              unavailableReason={att?.justifiedRate == null ? "Sem aulas elegíveis no recorte" : null}
            />
            <MetricCard
              label="Pré-matrículas atuais"
              value={data.academic.funnel.preEnrollments}
              explanation="Estoque atual de pré-matrículas. Não faz parte da mesma coorte acumulada das confirmadas."
              quality="ok"
            />
          </div>

          <details className="rounded-lg border border-[var(--card-border)] px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold">Reconciliação do não início (matrículas confirmadas)</summary>
            <p className="mt-2 text-[var(--text-muted)]">
              Recorte só de matrículas confirmadas — não mistura pessoas atendidas nem pré-matrículas.
            </p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              <li>Confirmadas: {f?.confirmed ?? 0}</li>
              <li>Iniciaram com presença registrada: {startedAmong}</li>
              <li>
                {attendanceProvisional ? "Sem início comprovado" : "Não iniciaram"}:{" "}
                {f?.confirmedNotStarted ?? Math.max(0, (f?.confirmed ?? 0) - startedAmong)}
              </li>
              <li>
                Percentual {attendanceProvisional ? "provisório" : "de não início"}:{" "}
                {f?.nonStartRateAmongConfirmed ?? "—"}%
              </li>
            </ul>
            {attendanceProvisional ? (
              <p className="mt-2 text-amber-800 dark:text-amber-300">
                Este percentual pode diminuir após a regularização das chamadas.
              </p>
            ) : null}
          </details>

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
                  <Bar dataKey="valor" name="Matrículas confirmadas" fill="#0284c7" radius={[4, 4, 0, 0]} />
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
