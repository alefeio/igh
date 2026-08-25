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
      enrollmentsInCycle: number;
      occupyingSeats: number;
      uniquePeople: number;
      started: number;
      notStarted: number;
      notStartedRate: number | null;
      completedStarted: number | null;
      completionStartedRate: number | null;
      cancelledStock: number;
      cancelledKnownReason: number;
      cancelledUnknownReason: number;
      streakThree: number;
      cancelledInferredAfterFour: number;
      cancellationPeriodQuality: "unavailable";
      cancelAfterStartUntyped: number;
      nearSuspension: number;
      unprocessedFourAbsences: number;
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
    streakThree?: number;
    cancelledKnownReason?: number;
    cancelledUnknownReason?: number;
    cancelledInferredAfterFour?: number;
    occupyingSeats?: number;
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
  const startedAmong = f?.started ?? 0;
  const journeyChart = useMemo(() => {
    if (!f) return [];
    return [
      { etapa: "Matrículas no ciclo", valor: f.enrollmentsInCycle },
      { etapa: "Ocupando vaga", valor: f.occupyingSeats },
      { etapa: "Iniciaram", valor: f.started },
      ...(f.completedStarted == null ? [] : [{ etapa: "Concluíram (turmas encerradas)", valor: f.completedStarted }]),
      { etapa: "Canceladas no recorte", valor: f.cancelledStock },
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
        description="Matrículas do ciclo e ocupação atual são leituras distintas. Frequência e início dependem das chamadas."
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
              label="Matrículas no ciclo"
              value={f?.enrollmentsInCycle ?? 0}
              explanation="Todos os registros do ciclo. Canceladas e concluídas entram no histórico."
              quality="ok"
            />
            <MetricCard
              label="Ocupando vaga"
              value={f?.occupyingSeats ?? data.academic.occupyingSeats ?? 0}
              explanation="Ativas e suspensas em turmas vigentes."
              quality="ok"
            />
            <MetricCard
              label="Pessoas únicas com matrícula"
              value={f?.uniquePeople ?? 0}
              quality="ok"
            />
            <MetricCard
              label="Suspensos atuais"
              value={data.academic.suspensions}
              explanation="Status suspenso no cadastro. Não presume três faltas."
              quality="ok"
            />
            <MetricCard
              label="Duas faltas consecutivas"
              value={attendanceProvisional ? null : (f?.nearSuspension ?? 0)}
              explanation="Identificadas na chamada. Distinto do estoque de suspensos."
              quality={attendanceProvisional ? "unavailable" : "ok"}
              unavailableReason={attendanceProvisional ? "Chamadas incompletas" : null}
            />
            <MetricCard
              label="Três faltas consecutivas"
              value={attendanceProvisional ? null : (f?.streakThree ?? 0)}
              explanation="Identificadas na chamada. Distinto do estoque de suspensos."
              quality={attendanceProvisional ? "unavailable" : "ok"}
              unavailableReason={attendanceProvisional ? "Chamadas incompletas" : null}
            />
            <MetricCard
              label="Cancelamentos com motivo conhecido"
              value={null}
              quality="unavailable"
              unavailableReason="Motivo estruturado ainda não existe no cadastro."
            />
            <MetricCard
              label="Cancelamentos sem motivo identificado"
              value={f?.cancelledUnknownReason ?? 0}
              explanation="Estoque no recorte de turmas. Não é fluxo do período."
              quality="ok"
            />
            <MetricCard
              label="Cancelamentos no período"
              value={null}
              quality="unavailable"
              unavailableReason="Não há data de cancelamento nem histórico de status. updatedAt não é usado como data do evento."
            />
            <MetricCard
              label="Quatro faltas sem cancelamento processado"
              value={attendanceProvisional ? null : (f?.unprocessedFourAbsences ?? 0)}
              explanation="Inconsistência de processamento ou qualidade de dados."
              quality={attendanceProvisional ? "unavailable" : "ok"}
              unavailableReason={attendanceProvisional ? "Chamadas incompletas" : null}
            />
            <MetricCard
              label="Cancelamento após sequência de faltas"
              value={attendanceProvisional ? null : (f?.cancelledInferredAfterFour ?? 0)}
              explanation="Cancelamento identificado após sequência de faltas — causa ainda não registrada de forma estruturada."
              quality={attendanceProvisional ? "unavailable" : "ok"}
              unavailableReason={attendanceProvisional ? "Chamadas incompletas" : null}
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
              label="Atendidos únicos"
              value={
                attendanceProvisional && data.academic.servedUnique === 0
                  ? null
                  : attendanceProvisional
                    ? `${data.academic.servedUnique.toLocaleString("pt-BR")} alunos com presença registrada`
                    : data.academic.servedUnique
              }
              explanation={
                attendanceProvisional && data.academic.servedUnique === 0
                  ? "Chamadas incompletas. Não interpretar a ausência de número como zero de alunos."
                  : attendanceProvisional
                    ? `Ao menos ${data.academic.servedUnique.toLocaleString("pt-BR")} alunos atendidos nos registros disponíveis. ${completenessLabel ?? ""} Leitura parcial.`
                    : "Pessoas distintas com pelo menos uma presença em aula no recorte."
              }
              quality={
                attendanceProvisional && data.academic.servedUnique === 0
                  ? "unavailable"
                  : attendanceProvisional
                    ? "partial"
                    : "ok"
              }
              unavailableReason={
                attendanceProvisional && data.academic.servedUnique === 0
                  ? "Chamadas incompletas. Não interpretar a ausência de número como zero de alunos."
                  : null
              }
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
              label="Início ainda não comprovado"
              value={attendanceProvisional && (f?.enrollmentsInCycle ?? 0) > 0 && startedAmong === 0 ? null : data.academic.funnel.notStartedRate}
              unit="%"
              explanation={
                attendanceProvisional
                  ? `Matrículas ${f?.enrollmentsInCycle ?? 0}; iniciaram ${startedAmong}; ainda sem presença ${f?.notStarted ?? 0}. Percentual provisório.`
                  : `Matrículas ${f?.enrollmentsInCycle ?? 0} − iniciaram ${startedAmong} = ainda sem presença ${f?.notStarted ?? 0}.`
              }
              quality={
                data.academic.funnel.notStartedRate == null
                  ? "unavailable"
                  : attendanceProvisional
                    ? "partial"
                    : "ok"
              }
              unavailableReason={data.academic.funnel.notStartedRate == null ? "Sem matrículas" : null}
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
          </div>

          <details className="rounded-lg border border-[var(--card-border)] px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold">Reconciliação do início ainda não comprovado</summary>
            <p className="mt-2 text-[var(--text-muted)]">
              Coorte de matrículas do ciclo, sem misturar pessoas atendidas.
            </p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              <li>Matrículas no ciclo: {f?.enrollmentsInCycle ?? 0}</li>
              <li>Iniciaram com presença registrada: {startedAmong}</li>
              <li>
                {attendanceProvisional ? "Sem início comprovado" : "Ainda sem presença"}: {f?.notStarted ?? 0}
              </li>
              <li>
                Percentual {attendanceProvisional ? "provisório" : ""}: {f?.notStartedRate ?? "—"}%
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
            description="Matrículas do ciclo, ocupação atual, início e cancelamentos. Ocupação não inclui canceladas nem concluídas."
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
                  <Bar dataKey="valor" name="Matrículas" fill="#0284c7" radius={[4, 4, 0, 0]} />
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
