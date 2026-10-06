"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartEmptyState } from "@/components/coordenacao/ChartEmptyState";
import {
  COORDINATOR_GLOSSARY,
  buildJourneySlices,
  buildPanelInsight,
  plainFunnelLabel,
  plainRetentionLabel,
  toneForAttendance,
  toneForDropout,
  toneForRiskCount,
} from "@/components/coordenacao/coordinator-copy";
import { InsightBanner } from "@/components/coordenacao/InsightBanner";
import { PedagogicalMetricCard } from "@/components/coordenacao/PedagogicalMetricCard";
import { useCoordinatorFilters } from "@/components/coordenacao/useCoordinatorFilters";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import type { ApiResponse } from "@/lib/api-types";
import { RISK_LEVEL_LABEL } from "@/lib/coordinator/labels";

type Indicator = { value: number | null; available: boolean; definition?: string };
type RiskRow = {
  enrollmentId: string;
  studentName: string;
  level: "CRITICAL" | "WARNING" | "ATTENTION";
  reasons: string[];
  attendancePercent: number | null;
};
type Snapshot = {
  cycles: { id: string; label: string; current: boolean }[];
  cycle: { id: string; label: string } | null;
  payload: {
    counts: {
      enrollments: number;
      started: number;
      atRisk: number;
      noShow: number;
      earlyDropout: number;
      dropout: number;
      completed: number;
    };
    occupation: Indicator;
    definitions: {
      attendanceRate: Indicator;
      dropoutRate: Indicator;
      completionRate: Indicator;
      startedRate: Indicator;
      noShowRate: Indicator;
    };
    funnel: { key: string; label: string; count: number }[];
    retention: { mark: number; label: string; count: number }[];
    risk: RiskRow[];
    weekly: { week: string; percent: number | null }[];
    classes: {
      id: string;
      course: string;
      teachers: string[];
      enrolled: number;
      capacity: number;
      occupancy: number | null;
      started: number;
      attendance: Indicator;
      atRisk: number;
      dropout: Indicator;
      completion: Indicator;
      progress: number | null;
      performance: number | null;
      attention: boolean;
    }[];
    reasons: { code: string; label: string; count: number }[];
    reasonsAvailable: boolean;
    lessons: { title: string; accuracy: number | null; answers: number }[];
    performance: {
      progress: Indicator;
      exerciseAccuracy: Indicator;
      exercisesAnswered: number;
      studentsWithoutActivity: number;
      score: Indicator;
    };
    learningGain: { available: boolean; initial: number | null; final: number | null; gain: number | null };
    teachers: {
      id: string;
      name: string;
      classes: number;
      students: number;
      attendance: number | null;
      retention: number | null;
    }[];
    experience: { available: boolean; count: number; platform: number | null; lessons: number | null; teacher: number | null };
    tickets: { subject: string; count: number }[];
    filters: {
      courses: { id: string; name: string }[];
      teachers: { id: string; name: string }[];
      classGroups: { id: string; label: string }[];
    };
  } | null;
};

function showValue(indicator: Indicator | undefined) {
  if (!indicator || !indicator.available || indicator.value == null) return "Sem dado";
  return `${indicator.value}%`;
}

function Tip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)]">
      <p className="font-medium">{label || payload[0]?.name}</p>
      {payload.map((item) => (
        <p key={item.name}>
          {item.name}: {item.value ?? 0}
        </p>
      ))}
    </div>
  );
}

export function CoordenacaoPainel({
  view,
}: {
  view: "painel" | "frequencia" | "risco" | "evasao" | "turmas" | "aproveitamento" | "experiencia" | "historico" | "intervencoes";
}) {
  const { filters, hydrated, update, adoptCatalog, clear, isDefault } = useCoordinatorFilters();
  const [data, setData] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<
    {
      label: string;
      enrollments: number;
      occupation: number | null;
      started: number;
      attendance: number | null;
      dropout: number | null;
      completion: number | null;
      progress: number | null;
    }[]
  >([]);
  const [interventions, setInterventions] = useState<
    {
      id: string;
      problem: string;
      action: string;
      status: string;
      owner: { name: string };
      attendancePercentBefore: number | null;
      attendancePercentAfter: number | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showSecondary, setShowSecondary] = useState(false);

  const load = useCallback(async () => {
    if (!hydrated) return;
    setLoading(true);
    try {
      if (view === "historico") {
        const res = await fetch("/api/coordenacao/pedagogico?view=historico", { cache: "no-store" });
        const json = (await res.json()) as ApiResponse<{ rows: typeof history }>;
        if (res.ok && json.ok) setHistory(json.data.rows);
      }
      if (view === "intervencoes") {
        const query = filters.cycleId ? `?cycleId=${filters.cycleId}` : "";
        const res = await fetch(`/api/coordenacao/intervencoes${query}`, { cache: "no-store" });
        const json = (await res.json()) as ApiResponse<{ rows: typeof interventions }>;
        if (res.ok && json.ok) setInterventions(json.data.rows);
      }
      const params = new URLSearchParams();
      if (filters.cycleId) params.set("cycleId", filters.cycleId);
      if (filters.courseId) params.set("courseId", filters.courseId);
      if (filters.teacherId) params.set("teacherId", filters.teacherId);
      if (filters.classGroupId) params.set("classGroupId", filters.classGroupId);
      if (filters.scope && filters.scope !== "all") params.set("scope", filters.scope);
      const res = await fetch(`/api/coordenacao/painel?${params}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<Snapshot>;
      if (res.ok && json.ok) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [view, hydrated, filters.cycleId, filters.courseId, filters.teacherId, filters.classGroupId, filters.scope]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.cycles.length) return;
    adoptCatalog({
      cycleIds: data.cycles.map((cycle) => cycle.id),
      courseIds: data.payload?.filters.courses.map((course) => course.id),
      teacherIds: data.payload?.filters.teachers.map((teacher) => teacher.id),
      classGroupIds: data.payload?.filters.classGroups.map((group) => group.id),
    });
  }, [adoptCatalog, data]);

  const payload = data?.payload;

  const insight = useMemo(() => {
    if (!payload) return null;
    return buildPanelInsight(payload.counts, payload.definitions);
  }, [payload]);

  const journeySlices = useMemo(() => (payload ? buildJourneySlices(payload.counts) : []), [payload]);

  const funnelData = useMemo(
    () =>
      (payload?.funnel ?? []).map((row) => ({
        ...row,
        label: plainFunnelLabel(row.label),
      })),
    [payload],
  );

  const retentionData = useMemo(
    () =>
      (payload?.retention ?? []).map((row) => ({
        ...row,
        label: plainRetentionLabel(row.label),
      })),
    [payload],
  );

  const weeklyData = useMemo(
    () => (payload?.weekly ?? []).filter((point) => point.percent != null),
    [payload],
  );

  async function registerIntervention(student: RiskRow) {
    const action = window.prompt(`Ação para ${student.studentName}`, "Contato individual");
    if (!action) return;
    await fetch("/api/coordenacao/intervencoes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enrollmentId: student.enrollmentId,
        cycleId: filters.cycleId,
        type: student.reasons.some(
          (reason) => reason.toLowerCase().includes("prova") || reason.toLowerCase().includes("progresso"),
        )
          ? "PERFORMANCE"
          : "ATTENDANCE",
        problem: student.reasons.join("; "),
        action,
        attendancePercentBefore: student.attendancePercent,
      }),
    });
    window.alert("Intervenção registrada.");
  }

  const showPriority =
    payload && (view === "painel" || view === "frequencia" || view === "risco" || view === "evasao");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardHero
        eyebrow="Coordenação pedagógica"
        title={
          view === "frequencia"
            ? "Frequência"
            : view === "risco"
              ? "Alunos em risco"
              : view === "evasao"
                ? "Evasão e retenção"
                : view === "turmas"
                  ? "Turmas"
                  : view === "aproveitamento"
                    ? "Aproveitamento"
                    : view === "experiencia"
                      ? "Experiência"
                      : view === "historico"
                        ? "Histórico dos ciclos"
                        : view === "intervencoes"
                          ? "Intervenções"
                          : "Visão geral"
        }
        description="Primeiro o que precisa de atenção; depois os detalhes da jornada dos alunos."
      />
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm text-[var(--text-secondary)]">
            Ciclo
            <select
              className="mt-1 h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2"
              value={filters.cycleId || data?.cycle?.id || ""}
              onChange={(event) => update({ cycleId: event.target.value, classGroupId: undefined })}
            >
              {(data?.cycles ?? []).map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.label}
                  {cycle.current ? " (atual)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[var(--text-secondary)]">
            Curso
            <select
              className="mt-1 h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2"
              value={filters.courseId ?? ""}
              onChange={(event) => update({ courseId: event.target.value || undefined, classGroupId: undefined })}
            >
              <option value="">Todos</option>
              {(payload?.filters.courses ?? []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[var(--text-secondary)]">
            Professor
            <select
              className="mt-1 h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2"
              value={filters.teacherId ?? ""}
              onChange={(event) => update({ teacherId: event.target.value || undefined, classGroupId: undefined })}
            >
              <option value="">Todos</option>
              {(payload?.filters.teachers ?? []).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[var(--text-secondary)]">
            Turma
            <select
              className="mt-1 h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2"
              value={filters.classGroupId ?? ""}
              onChange={(event) => update({ classGroupId: event.target.value || undefined })}
            >
              <option value="">Todas</option>
              {(payload?.filters.classGroups ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[var(--text-secondary)]">
            Tipo de turma
            <select
              className="mt-1 h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2"
              value={filters.scope ?? "all"}
              onChange={(event) => update({ scope: event.target.value as "all" | "internal" | "external" })}
            >
              <option value="all">Todas</option>
              <option value="internal">Da IGH</option>
              <option value="external">Parceiras (externas)</option>
            </select>
            <span className="mt-1 block text-xs text-[var(--text-muted)]">{COORDINATOR_GLOSSARY.tipoTurma}</span>
          </label>
        </div>
        <div>
          <button
            type="button"
            className="rounded-md border border-[var(--card-border)] px-3 py-2 text-sm text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={clear}
            disabled={isDefault(data?.cycles.find((cycle) => cycle.current)?.id ?? data?.cycle?.id ?? null)}
          >
            Limpar filtros
          </button>
        </div>
      </div>
      {loading ? <p className="text-sm text-[var(--text-muted)]">Carregando…</p> : null}

      {showPriority && insight ? (
        <InsightBanner headline={insight.headline} bullets={insight.bullets} tone={insight.tone} />
      ) : null}

      {payload && showPriority ? (
        <div className="grid gap-3 md:grid-cols-3">
          <PedagogicalMetricCard
            label="Frequência da turma"
            value={showValue(payload.definitions.attendanceRate)}
            meaning={COORDINATOR_GLOSSARY.frequenciaMedia}
            tone={toneForAttendance(payload.definitions.attendanceRate.available ? payload.definitions.attendanceRate.value : null)}
          />
          <PedagogicalMetricCard
            label="Alunos que precisam de atenção"
            value={String(payload.counts.atRisk)}
            meaning={COORDINATOR_GLOSSARY.alunosEmRisco}
            tone={toneForRiskCount(payload.counts.atRisk)}
          />
          <PedagogicalMetricCard
            label="Quem formou / saiu"
            value={`${payload.counts.completed} form. · ${payload.counts.earlyDropout + payload.counts.dropout} saíram`}
            meaning={`${COORDINATOR_GLOSSARY.conclusao} ${COORDINATOR_GLOSSARY.evasao}`}
            tone={toneForDropout(payload.definitions.dropoutRate.available ? payload.definitions.dropoutRate.value : null)}
          />
        </div>
      ) : null}

      {payload && (view === "painel" || view === "evasao") && (
        <SectionCard
          title="Jornada dos alunos"
          description="De quem entrou até quem se formou (apto a certificado) ou saiu."
          variant="elevated"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Situação atual (resumo)</h3>
              <div className="h-72">
                {journeySlices.length === 0 ? (
                  <ChartEmptyState description="Quando houver alunos no recorte, a pizza da jornada aparece aqui." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={journeySlices} dataKey="value" nameKey="name" innerRadius={48} outerRadius={90}>
                        {journeySlices.map((slice) => (
                          <Cell key={slice.name} fill={slice.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<Tip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Etapas da jornada</h3>
              <p className="mb-2 text-xs text-[var(--text-muted)]">Quantos alunos chegaram a cada etapa do curso.</p>
              <div className="h-72">
                {funnelData.length === 0 ? (
                  <ChartEmptyState />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelData}>
                      <CartesianGrid stroke="var(--card-border)" />
                      <XAxis dataKey="label" interval={0} angle={-25} textAnchor="end" height={90} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="count" name="Alunos" fill="var(--igh-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6">
            <h3 className="mb-1 text-sm font-medium text-[var(--text-secondary)]">Quantos alunos ainda acompanham o curso</h3>
            <p className="mb-2 text-xs text-[var(--text-muted)]">
              Entre quem já frequentou, quantos chegaram a cada marco de presença.
            </p>
            <div className="h-64">
              {retentionData.length === 0 ? (
                <ChartEmptyState />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={retentionData}>
                    <CartesianGrid stroke="var(--card-border)" />
                    <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="count" name="Ainda presentes no marco" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Não compareceram: {payload.counts.noShow}. Saiu no começo do curso: {payload.counts.earlyDropout}. Saiu
            depois de começar a frequentar: {payload.counts.dropout}. Formados (apto a certificado):{" "}
            {payload.counts.completed}.
          </p>
          {!payload.reasonsAvailable ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">Motivos de saída ainda não registrados neste recorte.</p>
          ) : (
            <ul className="mt-2 text-sm text-[var(--text-secondary)]">
              {payload.reasons.map((reason) => (
                <li key={reason.code}>
                  {reason.label}: {reason.count}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {payload && (view === "painel" || view === "frequencia") && (
        <SectionCard
          title="Frequência ao longo das semanas"
          description="Sem chamada lançada, a semana não conta como zero — só aparece quando há aula marcada."
          variant="elevated"
        >
          <div className="h-72">
            {weeklyData.length === 0 ? (
              <ChartEmptyState description="Assim que houver chamadas nas turmas do recorte, o gráfico semanal aparece aqui." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid stroke="var(--card-border)" />
                  <XAxis dataKey="week" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="percent" name="Frequência %" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      )}

      {payload && (view === "painel" || view === "risco") && (
        <SectionCard
          title="Precisam de atenção"
          description="Cada linha diz por que a pessoa aparece aqui. Abra a ficha para agir."
          variant="elevated"
        >
          {payload.risk.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhum aluno em alerta neste recorte.</p>
          ) : (
            <ul className="space-y-3">
              {payload.risk.map((student) => (
                <li key={student.enrollmentId} className="rounded-lg border border-[var(--card-border)] px-3 py-3">
                  <p className="font-medium text-[var(--text-primary)]">
                    {student.studentName} · {RISK_LEVEL_LABEL[student.level]}
                    {student.attendancePercent != null ? ` · frequência ${student.attendancePercent}%` : ""}
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-[var(--text-secondary)]">
                    {student.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <Link className="font-medium text-[var(--igh-primary)]" href={`/coordenacao/alunos/${student.enrollmentId}`}>
                      Abrir ficha do aluno
                    </Link>
                    <Link className="text-[var(--igh-primary)]" href={`/coordenacao/busca-ativa`}>
                      Registrar contato
                    </Link>
                    <button
                      type="button"
                      className="text-[var(--igh-primary)]"
                      onClick={() => void registerIntervention(student)}
                    >
                      Registrar intervenção
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {payload && showPriority ? (
        <div>
          <button
            type="button"
            className="text-sm font-medium text-[var(--igh-primary)]"
            onClick={() => setShowSecondary((value) => !value)}
          >
            {showSecondary ? "Ocultar outros números" : "Ver outros números (vagas, quem começou, etc.)"}
          </button>
          {showSecondary ? (
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <PedagogicalMetricCard
                label="Matrículas"
                value={String(payload.counts.enrollments)}
                meaning="Todas as matrículas do recorte, inclusive pré-matrícula."
              />
              <PedagogicalMetricCard
                label="Vagas preenchidas"
                value={showValue(payload.occupation)}
                meaning={COORDINATOR_GLOSSARY.vagasPreenchidas}
              />
              <PedagogicalMetricCard
                label="Quem começou"
                value={showValue(payload.definitions.startedRate)}
                meaning={payload.definitions.startedRate.definition ?? "Entre as matrículas confirmadas, quem veio à aula."}
              />
              <PedagogicalMetricCard
                label="Não compareceram"
                value={showValue(payload.definitions.noShowRate)}
                meaning={payload.definitions.noShowRate.definition ?? "Confirmou e ainda não veio a nenhuma aula."}
              />
              <PedagogicalMetricCard
                label="Evasão"
                value={showValue(payload.definitions.dropoutRate)}
                meaning={COORDINATOR_GLOSSARY.evasao}
                tone={toneForDropout(payload.definitions.dropoutRate.available ? payload.definitions.dropoutRate.value : null)}
              />
              <PedagogicalMetricCard
                label="Formados"
                value={showValue(payload.definitions.completionRate)}
                meaning={COORDINATOR_GLOSSARY.conclusao}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {payload && (view === "painel" || view === "turmas") && (
        <SectionCard title="Turmas" description="A lista aponta onde olhar, sem ranquear professor." variant="elevated">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-xs uppercase text-[var(--text-muted)]">
                  <th className="px-2 py-2">Curso</th>
                  <th className="px-2 py-2">Professores</th>
                  <th className="px-2 py-2">Inscritos</th>
                  <th className="px-2 py-2">Vagas preenchidas</th>
                  <th className="px-2 py-2">Iniciaram</th>
                  <th className="px-2 py-2">Frequência</th>
                  <th className="px-2 py-2">Risco</th>
                  <th className="px-2 py-2">Evasão</th>
                  <th className="px-2 py-2">Formados</th>
                </tr>
              </thead>
              <tbody>
                {payload.classes.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--card-border)]">
                    <td className="px-2 py-2">
                      {row.course}
                      {row.attention ? " · analisar" : ""}
                    </td>
                    <td className="px-2 py-2">{row.teachers.join(", ")}</td>
                    <td className="px-2 py-2">
                      {row.enrolled}/{row.capacity}
                    </td>
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
              <li key={teacher.id}>
                {teacher.name}: {teacher.classes} turmas, {teacher.students} matrículas, frequência{" "}
                {teacher.attendance == null ? "sem dado" : `${teacher.attendance}%`}, retenção de quem começou{" "}
                {teacher.retention == null ? "sem dado" : `${teacher.retention}%`}.
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {payload && (view === "painel" || view === "aproveitamento") && (
        <SectionCard title="Aproveitamento" description="A aula com menor acerto aparece primeiro." variant="elevated">
          <p className="text-sm text-[var(--text-secondary)]">
            Progresso médio: {showValue(payload.performance.progress)}. Acertos nos exercícios:{" "}
            {showValue(payload.performance.exerciseAccuracy)}. Provas: {showValue(payload.performance.score)}. Sem
            atividade registrada: {payload.performance.studentsWithoutActivity}.
          </p>
          {payload.lessons.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">Dados ainda não disponíveis para erros por aula.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
              {payload.lessons.slice(0, 12).map((lesson) => (
                <li key={lesson.title}>
                  {lesson.title}: {lesson.accuracy == null ? "sem respostas" : `${lesson.accuracy}% de acerto`} (
                  {lesson.answers} respostas)
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            {payload.learningGain.available
              ? `Diagnóstico: ${payload.learningGain.initial}%. Final: ${payload.learningGain.final}%. Ganho observado: ${payload.learningGain.gain != null && payload.learningGain.gain >= 0 ? "+" : ""}${payload.learningGain.gain} pontos percentuais. A média considera só alunos que entregaram os dois tipos.`
              : "Ganho de aprendizagem: dados ainda não disponíveis. As provas existentes ainda não estão classificadas como diagnóstica e final."}
          </p>
        </SectionCard>
      )}

      {payload && view === "experiencia" && (
        <SectionCard
          title="Experiência"
          description="Médias das avaliações já registradas, sem interpretação automática do texto."
          variant="elevated"
        >
          {!payload.experience.available ? (
            <p className="text-sm text-[var(--text-muted)]">Dados ainda não disponíveis.</p>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              {payload.experience.count} avaliações. Plataforma {payload.experience.platform}/10, aulas{" "}
              {payload.experience.lessons}/10, professor {payload.experience.teacher}/10.
            </p>
          )}
          <h3 className="mt-4 text-sm font-medium">Assuntos dos chamados</h3>
          {payload.tickets.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhum chamado neste recorte.</p>
          ) : (
            <ul className="text-sm text-[var(--text-secondary)]">
              {payload.tickets.map((ticket) => (
                <li key={ticket.subject}>
                  {ticket.subject}: {ticket.count}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {view === "historico" && (
        <SectionCard title="Ciclos" description="A comparação usa as mesmas fórmulas da visão do ciclo." variant="elevated">
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            {history.map((row) => (
              <li key={row.label}>
                {row.label}: {row.enrollments} matrículas, vagas preenchidas{" "}
                {row.occupation == null ? "sem dado" : `${row.occupation}%`}, iniciaram {row.started}, frequência{" "}
                {row.attendance == null ? "sem dado" : `${row.attendance}%`}, evasão{" "}
                {row.dropout == null ? "sem dado" : `${row.dropout}%`}, formados{" "}
                {row.completion == null ? "sem dado" : `${row.completion}%`}, progresso{" "}
                {row.progress == null ? "sem dado" : `${row.progress}%`}.
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {view === "intervencoes" && (
        <SectionCard
          title="Acompanhamento"
          description="O antes e o depois aparecem quando a frequência foi registrada. Não atribuímos causa automaticamente."
          variant="elevated"
        >
          {interventions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma intervenção registrada.</p>
          ) : (
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              {interventions.map((item) => (
                <li key={item.id}>
                  {item.problem} · {item.action} · {item.status} · {item.owner.name} · antes{" "}
                  {item.attendancePercentBefore ?? "—"}% · depois {item.attendancePercentAfter ?? "—"}%
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}
