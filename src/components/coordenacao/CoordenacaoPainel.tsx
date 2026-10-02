"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import type { ApiResponse } from "@/lib/api-types";
import { RISK_LEVEL_LABEL } from "@/lib/coordinator/labels";

type Indicator = { value: number | null; available: boolean; definition?: string };
type RiskRow = { enrollmentId: string; studentName: string; level: "CRITICAL" | "WARNING" | "ATTENTION"; reasons: string[]; attendancePercent: number | null };
type Snapshot = {
  cycles: { id: string; label: string; current: boolean }[];
  cycle: { id: string; label: string } | null;
  payload: {
    counts: { enrollments: number; started: number; atRisk: number; noShow: number; earlyDropout: number; dropout: number; completed: number };
    occupation: Indicator;
    definitions: { attendanceRate: Indicator; dropoutRate: Indicator; completionRate: Indicator; startedRate: Indicator; noShowRate: Indicator };
    funnel: { key: string; label: string; count: number }[];
    retention: { mark: number; label: string; count: number }[];
    risk: RiskRow[];
    weekly: { week: string; percent: number | null }[];
    classes: { id: string; course: string; teachers: string[]; enrolled: number; capacity: number; occupancy: number | null; started: number; attendance: Indicator; atRisk: number; dropout: Indicator; completion: Indicator; progress: number | null; performance: number | null; attention: boolean }[];
    reasons: { code: string; label: string; count: number }[];
    reasonsAvailable: boolean;
    lessons: { title: string; accuracy: number | null; answers: number }[];
    performance: { progress: Indicator; exerciseAccuracy: Indicator; exercisesAnswered: number; studentsWithoutActivity: number; score: Indicator };
    learningGain: { available: boolean; initial: number | null; final: number | null; gain: number | null };
    teachers: { id: string; name: string; classes: number; students: number; attendance: number | null; retention: number | null }[];
    experience: { available: boolean; count: number; platform: number | null; lessons: number | null; teacher: number | null };
    tickets: { subject: string; count: number }[];
    filters: { courses: { id: string; name: string }[]; teachers: { id: string; name: string }[]; classGroups: { id: string; label: string }[] };
  } | null;
};

function showValue(indicator: Indicator | undefined) {
  if (!indicator || !indicator.available || indicator.value == null) return "Dados ainda não disponíveis";
  return `${indicator.value}%`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3" title={hint}>
      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{hint ?? ""}</p>
    </div>
  );
}

export function CoordenacaoPainel({ view }: { view: "painel" | "frequencia" | "risco" | "evasao" | "turmas" | "aproveitamento" | "experiencia" | "historico" | "intervencoes" }) {
  const [cycleId, setCycleId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [classGroupId, setClassGroupId] = useState("");
  const [scope, setScope] = useState("all");
  const [data, setData] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<{ label: string; enrollments: number; occupation: number | null; started: number; attendance: number | null; dropout: number | null; completion: number | null; progress: number | null }[]>([]);
  const [interventions, setInterventions] = useState<{ id: string; problem: string; action: string; status: string; owner: { name: string }; attendancePercentBefore: number | null; attendancePercentAfter: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "historico") {
        const res = await fetch("/api/coordenacao/pedagogico?view=historico", { cache: "no-store" });
        const json = (await res.json()) as ApiResponse<{ rows: typeof history }>;
        if (res.ok && json.ok) setHistory(json.data.rows);
        return;
      }
      if (view === "intervencoes") {
        const res = await fetch(`/api/coordenacao/intervencoes${cycleId ? `?cycleId=${cycleId}` : ""}`, { cache: "no-store" });
        const json = (await res.json()) as ApiResponse<{ rows: typeof interventions }>;
        if (res.ok && json.ok) setInterventions(json.data.rows);
      }
      const params = new URLSearchParams();
      if (cycleId) params.set("cycleId", cycleId);
      if (courseId) params.set("courseId", courseId);
      if (teacherId) params.set("teacherId", teacherId);
      if (classGroupId) params.set("classGroupId", classGroupId);
      if (scope !== "all") params.set("scope", scope);
      const res = await fetch(`/api/coordenacao/painel?${params}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<Snapshot>;
      if (res.ok && json.ok) {
        setData(json.data);
        if (!cycleId && json.data.cycle) setCycleId(json.data.cycle.id);
      }
    } finally {
      setLoading(false);
    }
  }, [view, cycleId, courseId, teacherId, classGroupId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const payload = data?.payload;

  async function registerIntervention(student: RiskRow) {
    const action = window.prompt(`Ação para ${student.studentName}`, "Contato individual");
    if (!action) return;
    await fetch("/api/coordenacao/intervencoes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enrollmentId: student.enrollmentId,
        cycleId,
        type: student.reasons.some((reason) => reason.toLowerCase().includes("prova") || reason.toLowerCase().includes("progresso")) ? "PERFORMANCE" : "ATTENDANCE",
        problem: student.reasons.join("; "),
        action,
        attendancePercentBefore: student.attendancePercent,
      }),
    });
    window.alert("Intervenção registrada.");
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardHero
        eyebrow="Coordenação pedagógica"
        title={
          view === "frequencia" ? "Frequência" : view === "risco" ? "Alunos em risco" : view === "evasao" ? "Evasão e retenção" : view === "turmas" ? "Turmas" : view === "aproveitamento" ? "Aproveitamento" : view === "experiencia" ? "Experiência" : view === "historico" ? "Histórico dos ciclos" : view === "intervencoes" ? "Intervenções" : "Visão geral"
        }
        description="Da matrícula ao resultado, com o motivo de cada alerta visível."
      />
      {view !== "historico" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm text-[var(--text-secondary)]">Ciclo
            <select className="mt-1 h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2" value={cycleId} onChange={(event) => { setCycleId(event.target.value); setCourseId(""); setTeacherId(""); setClassGroupId(""); }}>
              {(data?.cycles ?? []).map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}{cycle.current ? " (atual)" : ""}</option>)}
            </select>
          </label>
          <label className="text-sm text-[var(--text-secondary)]">Curso
            <select className="mt-1 h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              <option value="">Todos</option>
              {(payload?.filters.courses ?? []).map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-[var(--text-secondary)]">Professor
            <select className="mt-1 h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
              <option value="">Todos</option>
              {(payload?.filters.teachers ?? []).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-[var(--text-secondary)]">Turma
            <select className="mt-1 h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2" value={classGroupId} onChange={(event) => setClassGroupId(event.target.value)}>
              <option value="">Todas</option>
              {(payload?.filters.classGroups ?? []).map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
            </select>
          </label>
          <label className="text-sm text-[var(--text-secondary)]">Vínculo
            <select className="mt-1 h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2" value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="all">Internas e externas</option>
              <option value="internal">Internas</option>
              <option value="external">Externas</option>
            </select>
          </label>
        </div>
      )}
      {loading ? <p className="text-sm text-[var(--text-muted)]">Carregando…</p> : null}

      {payload && (view === "painel" || view === "frequencia" || view === "risco") && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Matrículas" value={String(payload.counts.enrollments)} hint="Todas as matrículas do recorte, inclusive pré-matrícula." />
          <Kpi label="Ocupação" value={showValue(payload.occupation)} hint={payload.occupation.definition ?? ""} />
          <Kpi label="Frequência média" value={showValue(payload.definitions.attendanceRate)} hint={payload.definitions.attendanceRate.definition} />
          <Kpi label="Alunos em risco" value={String(payload.counts.atRisk)} hint="Quem ainda está na turma e acionou ao menos um sinal explicado abaixo." />
          <Kpi label="Evasão" value={showValue(payload.definitions.dropoutRate)} hint={payload.definitions.dropoutRate.definition} />
          <Kpi label="Conclusão" value={showValue(payload.definitions.completionRate)} hint={payload.definitions.completionRate.definition} />
          <Kpi label="Começaram" value={showValue(payload.definitions.startedRate)} hint={payload.definitions.startedRate.definition} />
          <Kpi label="Não compareceram" value={showValue(payload.definitions.noShowRate)} hint={payload.definitions.noShowRate.definition} />
        </div>
      )}

      {payload && (view === "painel" || view === "risco") && (
        <SectionCard title="Precisam de atenção" description="Cada linha diz por que a pessoa aparece aqui." variant="elevated">
          {payload.risk.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nenhum aluno em risco neste recorte.</p> : (
            <ul className="space-y-3">
              {payload.risk.map((student) => (
                <li key={student.enrollmentId} className="rounded-lg border border-[var(--card-border)] px-3 py-3">
                  <p className="font-medium text-[var(--text-primary)]">{student.studentName} · {RISK_LEVEL_LABEL[student.level]}</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-[var(--text-secondary)]">
                    {student.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                  <div className="mt-2 flex gap-3 text-sm">
                    <Link className="text-[var(--igh-primary)]" href={`/coordenacao/alunos/${student.enrollmentId}`}>Ver aluno</Link>
                    <Link className="text-[var(--igh-primary)]" href={`/coordenacao/busca-ativa`}>Registrar contato</Link>
                    <button type="button" className="text-[var(--igh-primary)]" onClick={() => void registerIntervention(student)}>Registrar intervenção</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {payload && (view === "painel" || view === "evasao") && (
        <SectionCard title="Jornada" description="Pré-matrícula sem confirmação não entra como evasão acadêmica." variant="elevated">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payload.funnel}>
                <CartesianGrid stroke="var(--card-border)" />
                <XAxis dataKey="label" interval={0} angle={-25} textAnchor="end" height={80} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Alunos" fill="var(--igh-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payload.retention}>
                <CartesianGrid stroke="var(--card-border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Ainda presentes no marco" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Não compareceu: {payload.counts.noShow}. Abandono precoce: {payload.counts.earlyDropout}. Evasão depois de frequentar: {payload.counts.dropout}. Concluíram: {payload.counts.completed}.
          </p>
          {!payload.reasonsAvailable ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">Motivos de saída ainda não registrados neste recorte.</p>
          ) : (
            <ul className="mt-2 text-sm text-[var(--text-secondary)]">
              {payload.reasons.map((reason) => <li key={reason.code}>{reason.label}: {reason.count}</li>)}
            </ul>
          )}
        </SectionCard>
      )}

      {payload && (view === "painel" || view === "frequencia") && (
        <SectionCard title="Frequência ao longo do tempo" description="Sem chamada lançada, a semana não vira zero." variant="elevated">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payload.weekly.filter((point) => point.percent != null)}>
                <CartesianGrid stroke="var(--card-border)" />
                <XAxis dataKey="week" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="percent" name="Frequência" fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {payload && (view === "painel" || view === "turmas") && (
        <SectionCard title="Turmas" description="A lista aponta onde olhar, sem ranquear professor." variant="elevated">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-xs uppercase text-[var(--text-muted)]">
                  <th className="px-2 py-2">Curso</th><th className="px-2 py-2">Professores</th><th className="px-2 py-2">Inscritos</th><th className="px-2 py-2">Ocupação</th><th className="px-2 py-2">Iniciaram</th><th className="px-2 py-2">Frequência</th><th className="px-2 py-2">Risco</th><th className="px-2 py-2">Evasão</th><th className="px-2 py-2">Conclusão</th>
                </tr>
              </thead>
              <tbody>
                {payload.classes.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--card-border)]">
                    <td className="px-2 py-2">{row.course}{row.attention ? " · analisar" : ""}</td>
                    <td className="px-2 py-2">{row.teachers.join(", ")}</td>
                    <td className="px-2 py-2">{row.enrolled}/{row.capacity}</td>
                    <td className="px-2 py-2">{row.occupancy == null ? "—" : `${row.occupancy}%`}</td>
                    <td className="px-2 py-2">{row.started}</td>
                    <td className="px-2 py-2">{showValue(row.attendance)}</td>
                    <td className="px-2 py-2">{row.atRisk}</td>
                    <td className="px-2 py-2">{showValue(row.dropout)}</td>
                    <td className="px-2 py-2">{showValue(row.completion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mt-6 text-sm font-medium text-[var(--text-primary)]">Acompanhamento por professor</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
            {payload.teachers.map((teacher) => (
              <li key={teacher.id}>{teacher.name}: {teacher.classes} turmas, {teacher.students} matrículas, frequência {teacher.attendance == null ? "sem dado" : `${teacher.attendance}%`}, retenção de quem começou {teacher.retention == null ? "sem dado" : `${teacher.retention}%`}.</li>
            ))}
          </ul>
        </SectionCard>
      )}

      {payload && (view === "painel" || view === "aproveitamento") && (
        <SectionCard title="Aproveitamento" description="A aula com menor acerto aparece primeiro." variant="elevated">
          <p className="text-sm text-[var(--text-secondary)]">Progresso médio: {showValue(payload.performance.progress)}. Acertos nos exercícios: {showValue(payload.performance.exerciseAccuracy)}. Provas: {showValue(payload.performance.score)}. Sem atividade registrada: {payload.performance.studentsWithoutActivity}.</p>
          {payload.lessons.length === 0 ? <p className="mt-3 text-sm text-[var(--text-muted)]">Dados ainda não disponíveis para erros por aula.</p> : (
            <ul className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
              {payload.lessons.slice(0, 12).map((lesson) => <li key={lesson.title}>{lesson.title}: {lesson.accuracy == null ? "sem respostas" : `${lesson.accuracy}% de acerto`} ({lesson.answers} respostas)</li>)}
            </ul>
          )}
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            {payload.learningGain.available
              ? `Diagnóstico: ${payload.learningGain.initial}%. Final: ${payload.learningGain.final}%. Ganho observado: ${payload.learningGain.gain != null && payload.learningGain.gain >= 0 ? "+" : ""}${payload.learningGain.gain} p.p. A média considera só alunos que entregaram os dois tipos.`
              : "Ganho de aprendizagem: dados ainda não disponíveis. As provas existentes ainda não estão classificadas como diagnóstica e final."}
          </p>
        </SectionCard>
      )}

      {payload && view === "experiencia" && (
        <SectionCard title="Experiência" description="Médias das avaliações já registradas, sem interpretação automática do texto." variant="elevated">
          {!payload.experience.available ? <p className="text-sm text-[var(--text-muted)]">Dados ainda não disponíveis.</p> : (
            <p className="text-sm text-[var(--text-secondary)]">{payload.experience.count} avaliações. Plataforma {payload.experience.platform}/10, aulas {payload.experience.lessons}/10, professor {payload.experience.teacher}/10.</p>
          )}
          <h3 className="mt-4 text-sm font-medium">Assuntos dos chamados</h3>
          {payload.tickets.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nenhum chamado neste recorte.</p> : (
            <ul className="text-sm text-[var(--text-secondary)]">{payload.tickets.map((ticket) => <li key={ticket.subject}>{ticket.subject}: {ticket.count}</li>)}</ul>
          )}
        </SectionCard>
      )}

      {view === "historico" && (
        <SectionCard title="Ciclos" description="A comparação usa as mesmas fórmulas da visão do ciclo." variant="elevated">
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            {history.map((row) => (
              <li key={row.label}>{row.label}: {row.enrollments} matrículas, ocupação {row.occupation == null ? "sem dado" : `${row.occupation}%`}, iniciaram {row.started}, frequência {row.attendance == null ? "sem dado" : `${row.attendance}%`}, evasão {row.dropout == null ? "sem dado" : `${row.dropout}%`}, conclusão {row.completion == null ? "sem dado" : `${row.completion}%`}, progresso {row.progress == null ? "sem dado" : `${row.progress}%`}.</li>
            ))}
          </ul>
        </SectionCard>
      )}

      {view === "intervencoes" && (
        <SectionCard title="Acompanhamento" description="O antes e o depois aparecem quando a frequência foi registrada. Não atribuímos causa automaticamente." variant="elevated">
          {interventions.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nenhuma intervenção registrada.</p> : (
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              {interventions.map((item) => (
                <li key={item.id}>{item.problem} · {item.action} · {item.status} · {item.owner.name} · antes {item.attendancePercentBefore ?? "—"}% · depois {item.attendancePercentAfter ?? "—"}%</li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}
