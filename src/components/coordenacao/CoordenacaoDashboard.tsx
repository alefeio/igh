"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartEmptyState } from "@/components/coordenacao/ChartEmptyState";
import { COORDINATOR_GLOSSARY } from "@/components/coordenacao/coordinator-copy";
import { PedagogicalMetricCard } from "@/components/coordenacao/PedagogicalMetricCard";
import { useCoordinatorFilters } from "@/components/coordenacao/useCoordinatorFilters";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import type { ApiResponse } from "@/lib/api-types";

type Point = { name: string; value: number };
type CourseCard = {
  courseName: string;
  capacidade: number;
  alunos: number;
  turmas: { id: string; label: string; alunos: number; capacidade: number }[];
};
type TeacherCard = {
  teacherName: string;
  alunos: number;
  turmas: { id: string; courseName: string; label: string; alunos: number; capacidade: number }[];
};

type DashboardPayload = {
  cycles: { id: string; label: string; current: boolean }[];
  cycle: { id: string; label: string } | null;
  filters: {
    courses: { id: string; name: string }[];
    teachers: { id: string; name: string }[];
    classGroups: { id: string; label: string }[];
  };
  kpis: {
    total: number;
    active: number;
    preEnrollment: number;
    confirmed: number;
    occupancyPercent: number;
  } | null;
  pieByCourse: Point[];
  byDay: Point[];
  attendancePie: Point[];
  timeline: { name: string; novas: number; acumulado: number }[];
  placeColumns: Point[];
  courses: CourseCard[];
  teachers: TeacherCard[];
};

const COLORS = ["#0066b3", "#1a365d", "#e87500", "#0d9488", "#65a30d", "#ca8a04", "#64748b", "#dc2626"];
const ATTENDANCE_COLORS: Record<string, string> = {
  "Abaixo de 50%": "#dc2626",
  "50% a 69%": "#ea580c",
  "70% ou mais": "#059669",
  "Sem aula lançada": "#94a3b8",
};

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

export function CoordenacaoDashboard() {
  const { filters, hydrated, update, adoptCatalog, clear, isDefault } = useCoordinatorFilters();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.cycleId) params.set("cycleId", filters.cycleId);
      if (filters.courseId) params.set("courseId", filters.courseId);
      if (filters.teacherId) params.set("teacherId", filters.teacherId);
      if (filters.classGroupId) params.set("classGroupId", filters.classGroupId);
      if (filters.scope && filters.scope !== "all") params.set("scope", filters.scope);
      const query = params.toString();
      const res = await fetch(`/api/coordenacao/matriculas${query ? `?${query}` : ""}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<DashboardPayload>;
      if (res.ok && json.ok) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [filters.cycleId, filters.courseId, filters.teacherId, filters.classGroupId, filters.scope]);

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [hydrated, load]);

  useEffect(() => {
    if (!data?.cycles.length) return;
    adoptCatalog({
      cycleIds: data.cycles.map((cycle) => cycle.id),
      courseIds: data.filters?.courses.map((course) => course.id),
      teacherIds: data.filters?.teachers.map((teacher) => teacher.id),
      classGroupIds: data.filters?.classGroups.map((group) => group.id),
    });
  }, [adoptCatalog, data]);

  const kpis = data?.kpis;
  const courses = data?.courses ?? [];
  const teachers = data?.teachers ?? [];
  const pieByCourse = data?.pieByCourse ?? [];
  const byDay = data?.byDay ?? [];
  const attendancePie = data?.attendancePie ?? [];
  const timeline = data?.timeline ?? [];
  const placeColumns = data?.placeColumns ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardHero
        eyebrow="Coordenação"
        title="Matrículas do ciclo"
        description="Compare cursos, turmas e professores pelas vagas e pelas matrículas — com linguagem simples."
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
              {(data?.filters?.courses ?? []).map((course) => (
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
              {(data?.filters?.teachers ?? []).map((teacher) => (
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
              {(data?.filters?.classGroups ?? []).map((group) => (
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

      {loading || !kpis ? (
        <p className="text-sm text-[var(--text-muted)]">{loading ? "Carregando…" : "Nenhum ciclo encontrado."}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PedagogicalMetricCard
              label="Total de matrículas"
              value={String(kpis.total)}
              meaning="Todas as matrículas do ciclo neste recorte."
            />
            <PedagogicalMetricCard
              label="Ativas"
              value={String(kpis.active)}
              meaning="Ativas = alunos estudando agora (ainda ocupam vaga na turma)."
              tone="ok"
            />
            <PedagogicalMetricCard
              label="Pré-matrículas"
              value={String(kpis.preEnrollment)}
              meaning="Aguardando confirmação — ainda não entram como turma plena."
              tone={kpis.preEnrollment > 0 ? "warning" : "neutral"}
            />
            <PedagogicalMetricCard
              label="Vagas preenchidas"
              value={`${kpis.occupancyPercent}%`}
              meaning={`${kpis.confirmed} confirmadas. ${COORDINATOR_GLOSSARY.vagasPreenchidas}`}
            />
          </div>

          <SectionCard
            title="Como está a frequência dos alunos"
            description="Faixas de presença entre quem ocupa vaga agora. Vermelho só quando a frequência está baixa."
            variant="elevated"
          >
            <div className="h-72">
              {attendancePie.length === 0 ? (
                <ChartEmptyState description="Quando houver alunos com frequência lançada, a pizza aparece aqui." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={attendancePie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={90}>
                      {attendancePie.map((item) => (
                        <Cell key={item.name} fill={ATTENDANCE_COLORS[item.name] ?? "#64748b"} />
                      ))}
                    </Pie>
                    <Tooltip content={<Tip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Comparação visual" description="Distribuição por curso e por dia de matrícula." variant="elevated">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Matrículas por curso</h3>
                <div className="h-72">
                  {pieByCourse.length === 0 ? (
                    <ChartEmptyState />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieByCourse} dataKey="value" nameKey="name" innerRadius={48} outerRadius={90}>
                          {pieByCourse.map((item, index) => (
                            <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
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
                <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Matrículas por dia</h3>
                <div className="h-72">
                  {byDay.length === 0 ? (
                    <ChartEmptyState />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byDay}>
                        <CartesianGrid stroke="var(--card-border)" />
                        <XAxis dataKey="name" interval={0} angle={-40} textAnchor="end" height={70} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                        <Tooltip content={<Tip />} />
                        <Bar dataKey="value" name="Matrículas" fill="var(--igh-primary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Entrada de matrículas ao longo do tempo"
            description="Novas matrículas por mês e o acumulado do ciclo."
            variant="elevated"
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-72">
                {timeline.length === 0 ? (
                  <ChartEmptyState description="Ainda não há datas de matrícula para montar a linha do tempo." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeline}>
                      <CartesianGrid stroke="var(--card-border)" />
                      <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="novas" name="Novas no mês" stroke="#0284c7" strokeWidth={2} />
                      <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="#0f766e" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Onde os alunos estudam</h3>
                <div className="h-72">
                  {placeColumns.length === 0 ? (
                    <ChartEmptyState description="Quando houver local cadastrado nas turmas, o gráfico aparece aqui." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={placeColumns} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid stroke="var(--card-border)" />
                        <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                        <Tooltip content={<Tip />} />
                        <Bar dataKey="value" name="Alunos" fill="#64748b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Vagas por curso e turma"
            description="Cinza é a capacidade (total de vagas). Azul é o preenchido. Vermelho só quando a turma está lotada."
            variant="elevated"
          >
            {courses.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nenhuma turma neste ciclo.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => {
                  const lotada = course.capacidade > 0 && course.alunos >= course.capacidade;
                  return (
                    <div key={course.courseName} className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
                      <h3 className="text-sm font-medium text-[var(--text-primary)]">{course.courseName}</h3>
                      <p className="mb-2 text-xs text-[var(--text-muted)]">
                        {course.alunos} de {course.capacidade} vagas preenchidas
                        {lotada ? " · turma lotada" : ""}
                      </p>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[{ name: course.courseName, capacidade: course.capacidade, alunos: course.alunos }]}>
                            <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                            <Tooltip content={<Tip />} />
                            <Legend />
                            <Bar dataKey="capacidade" name="Total de vagas" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                            <Bar
                              dataKey="alunos"
                              name="Vagas preenchidas"
                              fill={lotada ? "#dc2626" : "#2563eb"}
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="mt-3 space-y-1 border-t border-[var(--card-border)] pt-3 text-sm text-[var(--text-secondary)]">
                        {course.turmas.map((turma) => {
                          const full = turma.capacidade > 0 && turma.alunos >= turma.capacidade;
                          return (
                            <li key={turma.id} className="flex justify-between gap-3">
                              <span>{turma.label}</span>
                              <strong className={full ? "text-red-600" : "text-[var(--text-primary)]"}>
                                {turma.alunos}/{turma.capacidade || "—"}
                              </strong>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-4 border-t border-[var(--card-border)] pt-3 text-sm font-medium text-[var(--text-primary)]">
              Total de vagas preenchidas: {courses.reduce((sum, course) => sum + course.alunos, 0)}
              {courses.some((course) => course.capacidade > 0)
                ? ` / ${courses.reduce((sum, course) => sum + course.capacidade, 0)}`
                : ""}
            </p>
          </SectionCard>

          <SectionCard title="Por professor" description="Alunos que ocupam vaga, e as turmas de cada professor." variant="elevated">
            <div className="mb-6 h-72">
              {teachers.length === 0 ? (
                <ChartEmptyState />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teachers.map((teacher) => ({ name: teacher.teacherName, value: teacher.alunos }))}>
                    <CartesianGrid stroke="var(--card-border)" />
                    <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" height={70} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="value" name="Alunos" fill="var(--igh-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {teachers.map((teacher) => (
                <div key={teacher.teacherName} className="rounded-lg border border-[var(--card-border)] px-3 py-3">
                  <p className="font-medium text-[var(--text-primary)]">
                    {teacher.teacherName} · {teacher.alunos} alunos
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                    {teacher.turmas.map((turma) => (
                      <li key={turma.id} className="flex justify-between gap-3">
                        <span>
                          {turma.courseName} · {turma.label}
                        </span>
                        <strong>
                          {turma.alunos}/{turma.capacidade || "—"}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
