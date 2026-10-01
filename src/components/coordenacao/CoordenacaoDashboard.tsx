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

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import type { ApiResponse } from "@/lib/api-types";

type ChartPoint = { name: string; value: number };

type DashboardPayload = {
  cycles: { id: string; label: string; current: boolean }[];
  cycle: { id: string; label: string } | null;
  kpis: {
    total: number;
    active: number;
    suspended: number;
    completed: number;
    cancelled: number;
    waitlist: number;
    buscaAtiva: number;
    classes: number;
    occupancyPercent: number;
  } | null;
  statusPie: ChartPoint[];
  courseColumns: ChartPoint[];
  teacherColumns: ChartPoint[];
  classStatusColumns: ChartPoint[];
  timeline: ChartPoint[];
};

const COLORS = ["#0f766e", "#d97706", "#0284c7", "#e11d48", "#7c3aed", "#64748b", "#65a30d", "#c026d3"];

function ChartTooltip(props: { active?: boolean; payload?: { name?: string; value?: number }[]; label?: string }) {
  if (!props.active || !props.payload?.length) return null;
  const item = props.payload[0];
  return (
    <div className="rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)]">
      <p className="font-medium">{props.label || item.name}</p>
      <p>{item.value ?? 0}</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

export function CoordenacaoDashboard() {
  const [cycleId, setCycleId] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coordenacao/matriculas${id ? `?cycleId=${id}` : ""}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<DashboardPayload>;
      if (res.ok && json.ok) {
        setData(json.data);
        if (!id && json.data.cycle) setCycleId(json.data.cycle.id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  const kpis = data?.kpis;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardHero
        eyebrow="Coordenação"
        title="Matrículas do ciclo"
        description="Resumo visual das matrículas, turmas, ocupação e busca ativa."
      />
      <label className="flex max-w-xs flex-col gap-1 text-sm text-[var(--text-secondary)]">
        Ciclo
        <select
          className="h-10 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3"
          value={cycleId}
          onChange={(event) => {
            setCycleId(event.target.value);
            void load(event.target.value);
          }}
        >
          {(data?.cycles ?? []).map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.label}
              {cycle.current ? " (atual)" : ""}
            </option>
          ))}
        </select>
      </label>

      {loading || !kpis ? (
        <p className="text-sm text-[var(--text-muted)]">{loading ? "Carregando…" : "Nenhum ciclo encontrado."}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Matrículas" value={kpis.total} />
            <Kpi label="Ativas" value={kpis.active} />
            <Kpi label="Ocupação" value={`${kpis.occupancyPercent}%`} />
            <Kpi label="Busca ativa" value={kpis.buscaAtiva} />
            <Kpi label="Suspensas" value={kpis.suspended} />
            <Kpi label="Canceladas" value={kpis.cancelled} />
            <Kpi label="Concluídas" value={kpis.completed} />
            <Kpi label="Lista de espera" value={kpis.waitlist} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Situação das matrículas" variant="elevated">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data?.statusPie ?? []} dataKey="value" nameKey="name" innerRadius={48} outerRadius={90}>
                      {(data?.statusPie ?? []).map((item, index) => (
                        <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Novas matrículas por mês" variant="elevated">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.timeline ?? []}>
                    <CartesianGrid stroke="var(--card-border)" />
                    <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="value" name="Matrículas" stroke="#0f766e" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Matrículas por curso" variant="elevated">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.courseColumns ?? []}>
                    <CartesianGrid stroke="var(--card-border)" />
                    <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={70} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Matrículas" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Matrículas por professor" variant="elevated">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.teacherColumns ?? []}>
                    <CartesianGrid stroke="var(--card-border)" />
                    <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={70} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Matrículas" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Turmas do ciclo" variant="elevated">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.classStatusColumns ?? []}>
                    <CartesianGrid stroke="var(--card-border)" />
                    <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Turmas" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
