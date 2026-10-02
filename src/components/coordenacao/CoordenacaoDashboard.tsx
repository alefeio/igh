"use client";

import { useCallback, useEffect, useState } from "react";
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
  kpis: {
    total: number;
    active: number;
    preEnrollment: number;
    confirmed: number;
    occupancyPercent: number;
  } | null;
  pieByCourse: Point[];
  byDay: Point[];
  courses: CourseCard[];
  teachers: TeacherCard[];
};

const COLORS = ["#0066b3", "#1a365d", "#e87500", "#0d9488", "#7c3aed", "#dc2626", "#65a30d", "#ca8a04"];

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

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}

export function CoordenacaoDashboard() {
  const { filters, hydrated, update, adoptCatalog, clear, isDefault } = useCoordinatorFilters();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coordenacao/matriculas${id ? `?cycleId=${id}` : ""}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<DashboardPayload>;
      if (res.ok && json.ok) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void load(filters.cycleId ?? "");
  }, [hydrated, filters.cycleId, load]);

  useEffect(() => {
    if (!data?.cycles.length) return;
    adoptCatalog({ cycleIds: data.cycles.map((cycle) => cycle.id) });
  }, [adoptCatalog, data]);

  const kpis = data?.kpis;
  const courses = data?.courses ?? [];
  const teachers = data?.teachers ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardHero
        eyebrow="Coordenação"
        title="Matrículas do ciclo"
        description="Compare cursos, turmas e professores pelas vagas e pelas matrículas, no mesmo recorte de Matrículas."
      />
      <div className="flex flex-wrap items-end gap-3">
      <label className="flex max-w-xs flex-1 flex-col gap-1 text-sm text-[var(--text-secondary)]">
        Ciclo
        <select
          className="h-10 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3"
          value={filters.cycleId || data?.cycle?.id || ""}
          onChange={(event) => update({ cycleId: event.target.value })}
        >
          {(data?.cycles ?? []).map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.label}
              {cycle.current ? " (atual)" : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="h-10 rounded-md border border-[var(--card-border)] px-3 text-sm text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={clear}
        disabled={isDefault(data?.cycles.find((cycle) => cycle.current)?.id ?? data?.cycle?.id ?? null)}
      >
        Limpar filtros
      </button>
      </div>

      {loading || !kpis ? (
        <p className="text-sm text-[var(--text-muted)]">{loading ? "Carregando…" : "Nenhum ciclo encontrado."}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Total" value={String(kpis.total)} hint="Matrículas do ciclo" />
            <Kpi label="Ativas" value={String(kpis.active)} hint="Ainda na turma" />
            <Kpi label="Pré-matrículas" value={String(kpis.preEnrollment)} hint="Aguardando confirmação" />
            <Kpi label="Confirmadas" value={String(kpis.confirmed)} hint={`${kpis.occupancyPercent}% das vagas preenchidas`} />
          </div>

          <SectionCard title="Comparação visual" description="Distribuição por curso e por dia de matrícula." variant="elevated">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Matrículas por curso</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data?.pieByCourse ?? []} dataKey="value" nameKey="name" innerRadius={48} outerRadius={90}>
                        {(data?.pieByCourse ?? []).map((item, index) => (
                          <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<Tip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Matrículas por dia</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.byDay ?? []}>
                      <CartesianGrid stroke="var(--card-border)" />
                      <XAxis dataKey="name" interval={0} angle={-40} textAnchor="end" height={70} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="value" name="Matrículas" fill="var(--igh-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Vagas por curso e turma"
            description="Azul é a capacidade. Vermelho é o que já está preenchido. Abaixo, cada turma do curso."
            variant="elevated"
          >
            {courses.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nenhuma turma neste ciclo.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  <div key={course.courseName} className="rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-4">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">{course.courseName}</h3>
                    <p className="mb-2 text-xs text-[var(--text-muted)]">
                      {course.alunos} de {course.capacidade} vagas preenchidas
                    </p>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[{ name: course.courseName, capacidade: course.capacidade, alunos: course.alunos }]}>
                          <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                          <Tooltip content={<Tip />} />
                          <Legend />
                          <Bar dataKey="capacidade" name="Total de vagas" fill="#2563eb" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="alunos" name="Vagas preenchidas" fill="#dc2626" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="mt-3 space-y-1 border-t border-[var(--card-border)] pt-3 text-sm text-[var(--text-secondary)]">
                      {course.turmas.map((turma) => (
                        <li key={turma.id} className="flex justify-between gap-3">
                          <span>{turma.label}</span>
                          <strong className={turma.capacidade > 0 && turma.alunos >= turma.capacidade ? "text-red-600" : "text-green-600"}>
                            {turma.alunos}/{turma.capacidade || "—"}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teachers.map((teacher) => ({ name: teacher.teacherName, value: teacher.alunos }))}>
                  <CartesianGrid stroke="var(--card-border)" />
                  <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" height={70} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="value" name="Alunos" fill="var(--igh-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
