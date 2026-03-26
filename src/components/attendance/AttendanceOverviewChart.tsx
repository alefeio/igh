"use client";

import { useMemo } from "react";
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

import { MAX_COURSES_CHART, chartRowsForExport } from "@/lib/attendance-course-chart";
import type { AttendanceClassGroupSummary } from "./AttendanceOverviewClient";

const COL = {
  present: "#10b981",
  absentRaw: "#f43f5e",
  justified: "#d97706",
} as const;

type ChartRow = {
  key: string;
  label: string;
  present: number;
  absentSemJust: number;
  justificada: number;
};

/** Quebra o nome em até 3 linhas para o eixo Y (SVG). */
function wrapCourseName(text: string, maxPerLine: number): string[] {
  const t = text.trim();
  if (t.length <= maxPerLine) return [t];
  const words = t.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxPerLine) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function CourseYAxisTick(props: Record<string, unknown>) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const payload = props.payload as { value?: string | number } | undefined;
  const raw = payload?.value;
  if (raw === undefined || raw === null) return null;
  const text = String(raw);
  const lines = wrapCourseName(text, 34);
  const lineHeight = 11;
  const offsetY = -((lines.length - 1) * lineHeight) / 2;

  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="end" fill="var(--text-muted)" fontSize={10}>
        {lines.map((line, i) => (
          <tspan key={i} x={0} dy={i === 0 ? offsetY : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export function AttendanceOverviewChart({ groups }: { groups: AttendanceClassGroupSummary[] }) {
  const { data, truncated, yAxisWidth } = useMemo(() => {
    if (!groups.length) {
      return { data: [] as ChartRow[], truncated: false, yAxisWidth: 200 };
    }

    const { rows, truncated } = chartRowsForExport(
      groups.map((g) => ({
        courseId: g.courseId,
        courseName: g.courseName,
        presentSum: g.presentSum,
        absentSum: g.absentSum,
        justifiedAbsentSum: g.justifiedAbsentSum,
      })),
      MAX_COURSES_CHART,
    );

    const chartData: ChartRow[] = rows.map((r) => ({
      key: r.courseName,
      label: r.courseName,
      present: r.present,
      absentSemJust: r.absentSemJust,
      justificada: r.justificada,
    }));

    const longest = chartData.reduce((m, r) => Math.max(m, r.label.length), 0);
    const yAxisWidth = Math.min(380, Math.max(200, 32 + Math.min(longest, 120) * 4.2));

    return { data: chartData, truncated, yAxisWidth };
  }, [groups]);

  if (!data.length) {
    return (
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
        Sem dados para o gráfico (nenhuma turma no filtro).
      </div>
    );
  }

  const chartHeight = Math.min(520, 80 + data.length * 44);

  const tooltipStyle = {
    backgroundColor: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: "8px",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  };

  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <div className="mb-3">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Distribuição por curso</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Cada barra soma todas as turmas do mesmo curso: presenças, ausências sem justificativa e
          ausências justificadas.
        </p>
        {truncated ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Mostrando os {MAX_COURSES_CHART} cursos com maior volume de registros (presenças + ausências).
          </p>
        ) : null}
      </div>
      <div className="w-full min-w-0 pl-1" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              stroke="var(--card-border)"
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={yAxisWidth}
              tick={(props) => <CourseYAxisTick {...(props as Record<string, unknown>)} />}
              stroke="var(--card-border)"
              interval={0}
            />
            <Tooltip
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as ChartRow | undefined;
                return row?.label ?? "";
              }}
              wrapperStyle={tooltipStyle}
              contentStyle={{
                backgroundColor: "var(--card-bg)",
                border: "none",
                borderRadius: "8px",
                color: "var(--text-primary)",
              }}
              labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
              itemStyle={{ color: "var(--text-primary)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
            <Bar dataKey="present" stackId="a" fill={COL.present} name="Presenças" />
            <Bar dataKey="absentSemJust" stackId="a" fill={COL.absentRaw} name="Ausências (sem just.)" />
            <Bar dataKey="justificada" stackId="a" fill={COL.justified} name="Ausências justificadas" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
