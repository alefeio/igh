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

type Point = { name: string; value: number };
type CoursePoint = { name: string; ativas: number; canceladas: number; concluidas: number };
type ClassRow = {
  id: string;
  course: string;
  teacher: string;
  place: string;
  status: string;
  enrolled: number;
  capacity: number;
  occupancy: number;
  waitlist: number;
  startTime: string;
};

type DashboardPayload = {
  cycles: { id: string; label: string; current: boolean }[];
  cycle: { id: string; label: string } | null;
  kpis: {
    total: number;
    active: number;
    preEnrollment: number;
    confirmed: number;
    suspended: number;
    cancelled: number;
    cancelRate: number;
    completed: number;
    waitlist: number;
    openSeats: number;
    occupancyPercent: number;
    classes: number;
    lowOccupancyClasses: number;
    attendanceAverage: number | null;
    below70: number;
    occupyingWithoutBusca: number;
    certificateEligible: number;
    certificateIssued: number;
    closedBase: number;
  } | null;
  statusPie: Point[];
  confirmationPie: Point[];
  attendancePie: Point[];
  timeline: { name: string; novas: number; acumulado: number }[];
  courseColumns: CoursePoint[];
  placeColumns: Point[];
  classStatusColumns: Point[];
  attentionClasses: ClassRow[];
};

const COLORS = ["#0f766e", "#d97706", "#0284c7", "#e11d48", "#7c3aed", "#64748b", "#65a30d", "#c026d3"];

function Tip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
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

function PieCard({ title, description, data }: { title: string; description: string; data: Point[] }) {
  return (
    <SectionCard title={title} description={description} variant="elevated">
      <div className="h-72">
        {data.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--text-muted)]">Sem dados neste ciclo.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88}>
                {data.map((item, index) => (
                  <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<Tip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
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
        description="Ocupação, evasão, frequência, pré-matrícula e turmas que pedem ação."
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Ocupação" value={`${kpis.occupancyPercent}%`} hint={`${kpis.openSeats} vagas ainda abertas`} />
            <Kpi label="Ativas" value={String(kpis.active)} hint={`${kpis.confirmed} confirmadas · ${kpis.preEnrollment} pré-matrículas`} />
            <Kpi label="Evasão" value={`${kpis.cancelRate}%`} hint={`${kpis.cancelled} canceladas de ${kpis.total}`} />
            <Kpi
              label="Frequência média"
              value={kpis.attendanceAverage == null ? "—" : `${kpis.attendanceAverage}%`}
              hint={`${kpis.below70} alunos abaixo de 70%`}
            />
            <Kpi label="Suspensas" value={String(kpis.suspended)} hint="Pedem retorno ou busca ativa" />
            <Kpi label="Sem busca ativa" value={String(kpis.occupyingWithoutBusca)} hint="Ativos ou suspensos sem registro" />
            <Kpi label="Lista de espera" value={String(kpis.waitlist)} hint="Ainda aguardando vaga" />
            <Kpi
              label="Certificado"
              value={`${kpis.certificateIssued}/${kpis.certificateEligible}`}
              hint={`${kpis.closedBase} alunos em turmas encerradas`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <PieCard title="Situação das matrículas" description="Como o ciclo está distribuído agora." data={data?.statusPie ?? []} />
            <PieCard title="Confirmação" description="Ativas já confirmadas e pré-matrículas." data={data?.confirmationPie ?? []} />
            <PieCard title="Frequência de quem ocupa vaga" description="Corte de 70% para certificado." data={data?.attendancePie ?? []} />
          </div>

          <SectionCard title="Entrada de matrículas" description="Novas no mês e total acumulado no ciclo." variant="elevated">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.timeline ?? []}>
                  <CartesianGrid stroke="var(--card-border)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                  <Tooltip content={<Tip />} />
                  <Legend />
                  <Line type="monotone" dataKey="novas" name="Novas" stroke="#0284c7" strokeWidth={2} />
                  <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="#0f766e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Ativas e canceladas por curso" description="Onde a evasão pesa mais." variant="elevated">
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.courseColumns ?? []}>
                    <CartesianGrid stroke="var(--card-border)" />
                    <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={80} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <Tooltip content={<Tip />} />
                    <Legend />
                    <Bar dataKey="ativas" name="Ocupando vaga" stackId="a" fill="#0f766e" />
                    <Bar dataKey="concluidas" name="Concluídas" stackId="a" fill="#0284c7" />
                    <Bar dataKey="canceladas" name="Canceladas" stackId="a" fill="#e11d48" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Alunos por local" description="Onde a demanda está concentrada." variant="elevated">
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.placeColumns ?? []} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid stroke="var(--card-border)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="value" name="Alunos" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Turmas com menor ocupação"
            description={`${kpis.lowOccupancyClasses} turmas abertas, planejadas ou em andamento estão abaixo de 50%.`}
            variant="elevated"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)] text-xs uppercase text-[var(--text-muted)]">
                    <th className="px-2 py-2">Curso</th>
                    <th className="px-2 py-2">Professor</th>
                    <th className="px-2 py-2">Local</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Horário</th>
                    <th className="px-2 py-2">Vagas</th>
                    <th className="px-2 py-2">Espera</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.attentionClasses ?? []).map((row) => (
                    <tr key={row.id} className="border-b border-[var(--card-border)] last:border-0">
                      <td className="px-2 py-2 font-medium text-[var(--text-primary)]">{row.course}</td>
                      <td className="px-2 py-2 text-[var(--text-secondary)]">{row.teacher}</td>
                      <td className="px-2 py-2 text-[var(--text-secondary)]">{row.place}</td>
                      <td className="px-2 py-2 text-[var(--text-secondary)]">{row.status}</td>
                      <td className="px-2 py-2 text-[var(--text-secondary)]">{row.startTime}</td>
                      <td className="px-2 py-2 text-[var(--text-secondary)]">
                        {row.enrolled}/{row.capacity} ({row.occupancy}%)
                      </td>
                      <td className="px-2 py-2 text-[var(--text-secondary)]">{row.waitlist}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
