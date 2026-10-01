"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import type { ApiResponse } from "@/lib/api-types";
import { DEPARTURE_REASON_LABEL, RISK_LEVEL_LABEL } from "@/lib/coordinator/labels";
import type { DepartureReasonCode } from "@/lib/coordinator/types";

type Observed = { available: boolean; before: number | null; after: number | null; delta: number | null; note: string };
type Payload = {
  course: string;
  teachers: string[];
  classTime: string;
  cycleLabel: string;
  contact: { phone: string | null; email: string | null };
  sheet: {
    identification: { name: string; enrollmentId: string; status: string };
    journey: { enrolledAt: string | null; confirmedAt: string | null; firstPresentAt: string | null; stage: string; departureReason: DepartureReasonCode | null; transferHasDestination: boolean };
    attendance: { present: number; absences: number; justified: number; percent: number | null; consecutiveAbsences: number; trend: { previous: number; recent: number; delta: number } | null };
    progress: { percent: number | null; started: number; completed: number; total: number; lastActivityAt: string | null; inactiveDays: number | null };
    performance: { exercisesAnswered: number; accuracy: number | null; examsSubmitted: number; examsPending: number; score: number | null };
    risk: { level: "CRITICAL" | "WARNING" | "ATTENTION" | null; reasons: string[] };
    timeline: { at: string; label: string }[];
    hasAcademicData: boolean;
  };
  departures: { id: string; reason: DepartureReasonCode; note: string | null; recordedAt: string; recordedBy: { name: string } }[];
  interventions: { id: string; problem: string; action: string; status: string; resultNote: string | null; createdAt: string; owner: { name: string }; observed: Observed }[];
};

function textDate(value: string | null) {
  if (!value) return "não registrada";
  return new Date(value).toLocaleDateString("pt-BR");
}

function percent(value: number | null) {
  return value == null ? "Dados ainda não disponíveis" : `${value}%`;
}

export default function AlunoCoordenacaoPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [reason, setReason] = useState<DepartureReasonCode>("OTHER");
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void fetch(`/api/coordenacao/alunos/${params.id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json: ApiResponse<Payload>) => {
        if (json.ok) setData(json.data);
        else setMissing(true);
      });
  }, [params.id]);

  async function saveReason() {
    await fetch("/api/coordenacao/saida", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enrollmentId: params.id, reason, note }),
    });
    window.location.reload();
  }

  if (missing) return <p className="text-sm text-[var(--text-muted)]">Matrícula não encontrada.</p>;
  if (!data) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;
  const sheet = data.sheet;

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero eyebrow="Ficha do aluno" title={sheet.identification.name} description={`${data.course} · ${data.teachers.join(", ")} · ${data.classTime} · ${data.cycleLabel}`} />
      <SectionCard title="Identificação" variant="elevated">
        <p className="text-sm text-[var(--text-secondary)]">Matrícula {sheet.identification.enrollmentId}. Status {sheet.identification.status}. Contato {data.contact.phone || "sem telefone"} · {data.contact.email || "sem e-mail"}.</p>
      </SectionCard>
      <SectionCard title="Jornada" variant="elevated">
        <p className="text-sm text-[var(--text-secondary)]">Matrícula em {textDate(sheet.journey.enrolledAt)}. Confirmação {textDate(sheet.journey.confirmedAt)}. Primeiro comparecimento {textDate(sheet.journey.firstPresentAt)}. Estágio {sheet.journey.stage}.</p>
        {sheet.journey.departureReason === "TRANSFER" ? <p className="mt-2 text-sm text-[var(--text-muted)]">Transferência registrada sem turma de destino vinculada. Isso não conta como evasão institucional, mas o destino não foi informado pelo sistema.</p> : null}
      </SectionCard>
      <SectionCard title="Frequência" variant="elevated">
        {!sheet.hasAcademicData && sheet.attendance.percent == null ? <p className="text-sm text-[var(--text-muted)]">Dados ainda não disponíveis.</p> : (
          <p className="text-sm text-[var(--text-secondary)]">{sheet.attendance.present} presenças, {sheet.attendance.absences} faltas, {sheet.attendance.justified} justificadas. Frequência {percent(sheet.attendance.percent)}. Faltas consecutivas: {sheet.attendance.consecutiveAbsences}. {sheet.attendance.trend ? `Tendência recente: de ${sheet.attendance.trend.previous}% para ${sheet.attendance.trend.recent}% (${sheet.attendance.trend.delta >= 0 ? "+" : ""}${sheet.attendance.trend.delta} p.p.).` : "Tendência recente ainda sem aulas suficientes."}</p>
        )}
      </SectionCard>
      <SectionCard title="Progresso e aproveitamento" variant="elevated">
        <p className="text-sm text-[var(--text-secondary)]">Aulas {sheet.progress.completed} concluídas de {sheet.progress.total || "—"}. Iniciadas {sheet.progress.started}. Progresso {percent(sheet.progress.percent)}. Última atividade {textDate(sheet.progress.lastActivityAt)}. {sheet.progress.inactiveDays == null ? "Inatividade sem acesso registrado." : `${sheet.progress.inactiveDays} dias sem acesso.`} Exercícios {sheet.performance.exercisesAnswered}, acerto {percent(sheet.performance.accuracy)}. Provas entregues {sheet.performance.examsSubmitted}. Pendentes {sheet.performance.examsPending}. Média {percent(sheet.performance.score)}.</p>
      </SectionCard>
      <SectionCard title="Risco" variant="elevated">
        {sheet.risk.level == null ? <p className="text-sm text-[var(--text-muted)]">Nenhum sinal de risco com os dados atuais.</p> : (
          <>
            <p className="font-medium text-[var(--text-primary)]">{RISK_LEVEL_LABEL[sheet.risk.level]}</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-[var(--text-secondary)]">{sheet.risk.reasons.map((item) => <li key={item}>{item}</li>)}</ul>
          </>
        )}
      </SectionCard>
      <SectionCard title="Motivo de saída" description="O registro complementa o status da matrícula e não o substitui. O histórico anterior permanece." variant="elevated">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="h-10 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2" value={reason} onChange={(event) => setReason(event.target.value as DepartureReasonCode)}>
            {Object.entries(DEPARTURE_REASON_LABEL).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <input className="h-10 flex-1 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observação" />
          <button type="button" className="h-10 rounded-md bg-[var(--igh-primary)] px-3 text-white" onClick={() => void saveReason()}>Registrar</button>
        </div>
        <ul className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
          {data.departures.map((item) => <li key={item.id}>{textDate(item.recordedAt)} · {DEPARTURE_REASON_LABEL[item.reason]} · {item.recordedBy.name} · {item.note || "sem observação"}</li>)}
        </ul>
      </SectionCard>
      <SectionCard title="Intervenções" variant="elevated">
        {data.interventions.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nenhuma intervenção nesta matrícula.</p> : (
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            {data.interventions.map((item) => (
              <li key={item.id}>
                {textDate(item.createdAt)} · {item.status} · {item.owner.name} · {item.problem} · {item.action}
                {item.observed.available
                  ? ` Antes da intervenção: ${item.observed.before}%. Após a intervenção: ${item.observed.after}%. Evolução observada: ${item.observed.delta != null && item.observed.delta >= 0 ? "+" : ""}${item.observed.delta} p.p. ${item.observed.note}`
                  : ` ${item.observed.note}`}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Linha do tempo" variant="elevated">
        {sheet.timeline.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Dados ainda não disponíveis.</p> : (
          <ul className="space-y-1 text-sm text-[var(--text-secondary)]">{sheet.timeline.map((item) => <li key={`${item.at}-${item.label}`}>{textDate(item.at)} · {item.label}</li>)}</ul>
        )}
      </SectionCard>
    </div>
  );
}
