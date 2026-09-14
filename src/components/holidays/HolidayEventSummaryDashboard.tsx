"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  GraduationCap,
  Share2,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";

import { StatTile } from "@/components/dashboard/DashboardUI";

export type EventSummaryRegistration = {
  id: string;
  present: boolean | null;
  confirmationEmailSentAt: string | null;
  reminderEmailSentAt: string | null;
  user: { id: string } | null;
  referrerUser: { id: string; name: string } | null;
  studentLink: {
    studentId: string;
    name: string;
    match: "user" | "email" | "cpf";
    courses: Array<{
      courseId: string;
      courseName: string;
      classGroupName: string;
      enrollmentStatus: string;
    }>;
  } | null;
};

const PROFILE_COLORS = {
  alunos: "#059669",
  contas: "#2563eb",
  convidados: "#a16207",
};

const PRESENCE_COLORS = {
  presente: "#059669",
  ausente: "#e11d48",
  pendente: "#71717a",
};

function pct(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function HolidayEventSummaryDashboard({
  items,
  capacity = null,
}: {
  items: EventSummaryRegistration[];
  capacity?: number | null;
}) {
  const stats = useMemo(() => {
    const total = items.length;
    let students = 0;
    let withAccount = 0;
    let guests = 0;
    let present = 0;
    let absent = 0;
    let pendingPresence = 0;
    let withReferral = 0;
    let confirmationSent = 0;
    let reminderSent = 0;

    const courseMap = new Map<string, { name: string; count: number }>();
    const referrerMap = new Map<string, { name: string; total: number; present: number }>();

    for (const row of items) {
      if (row.studentLink) students += 1;
      else if (row.user) withAccount += 1;
      else guests += 1;

      if (row.present === true) present += 1;
      else if (row.present === false) absent += 1;
      else pendingPresence += 1;

      if (row.referrerUser) {
        withReferral += 1;
        const key = row.referrerUser.id;
        const entry = referrerMap.get(key) ?? {
          name: row.referrerUser.name,
          total: 0,
          present: 0,
        };
        entry.total += 1;
        if (row.present === true) entry.present += 1;
        referrerMap.set(key, entry);
      }

      if (row.confirmationEmailSentAt) confirmationSent += 1;
      if (row.reminderEmailSentAt) reminderSent += 1;

      if (row.studentLink) {
        const seenCourses = new Set<string>();
        for (const c of row.studentLink.courses) {
          if (seenCourses.has(c.courseId)) continue;
          seenCourses.add(c.courseId);
          const cur = courseMap.get(c.courseId) ?? { name: c.courseName, count: 0 };
          cur.count += 1;
          courseMap.set(c.courseId, cur);
        }
      }
    }

    const topCourses = [...courseMap.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 8)
      .map((c) => ({ name: c.name.length > 28 ? `${c.name.slice(0, 26)}…` : c.name, fullName: c.name, count: c.count }));

    const topReferrers = [...referrerMap.values()]
      .sort((a, b) => b.total - a.total || b.present - a.present || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 8);

    const profileChart = [
      { name: "Alunos", key: "alunos", value: students, color: PROFILE_COLORS.alunos },
      { name: "Com conta", key: "contas", value: withAccount, color: PROFILE_COLORS.contas },
      { name: "Convidados", key: "convidados", value: guests, color: PROFILE_COLORS.convidados },
    ].filter((d) => d.value > 0);

    const presenceChart = [
      { name: "Presentes", key: "presente", value: present, color: PRESENCE_COLORS.presente },
      { name: "Ausentes", key: "ausente", value: absent, color: PRESENCE_COLORS.ausente },
      { name: "Pendentes", key: "pendente", value: pendingPresence, color: PRESENCE_COLORS.pendente },
    ].filter((d) => d.value > 0);

    return {
      total,
      students,
      withAccount,
      guests,
      present,
      absent,
      pendingPresence,
      withReferral,
      confirmationSent,
      reminderSent,
      topCourses,
      topReferrers,
      profileChart,
      presenceChart,
      capacityFill:
        capacity != null && capacity > 0
          ? Math.min(100, Math.round((total / capacity) * 100))
          : null,
    };
  }, [items, capacity]);

  if (stats.total === 0) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)]/40 px-4 py-5 text-sm text-[var(--text-muted)]">
        Ainda sem inscritos nesta ocorrência — o resumo aparece assim que houver cadastros.
        {capacity != null ? (
          <span className="mt-1 block text-xs">Capacidade do evento: {capacity} vaga{capacity === 1 ? "" : "s"}.</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/35 p-3 sm:p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Resumo do evento</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Indicadores desta ocorrência — alunos, cursos, indicações e presença.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Inscritos"
          value={stats.total}
          sublabel={
            capacity != null
              ? `Capacidade ${capacity} · ${stats.capacityFill ?? 0}% preenchido`
              : "Sem limite de vagas"
          }
          icon={Users}
          accent="default"
        />
        <StatTile
          label="Alunos IGH"
          value={stats.students}
          sublabel={`${pct(stats.students, stats.total)} do total · ${stats.withAccount} só conta · ${stats.guests} convidado${stats.guests === 1 ? "" : "s"}`}
          icon={GraduationCap}
          accent="emerald"
        />
        <StatTile
          label="Com indicação"
          value={stats.withReferral}
          sublabel={`${pct(stats.withReferral, stats.total)} chegaram por indicação`}
          icon={Share2}
          accent="violet"
        />
        <StatTile
          label="Presentes"
          value={stats.present}
          sublabel={`${stats.absent} ausente${stats.absent === 1 ? "" : "s"} · ${stats.pendingPresence} pendente${stats.pendingPresence === 1 ? "" : "s"}`}
          icon={UserCheck}
          accent="amber"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            <UserRound className="h-3.5 w-3.5" />
            Perfil dos inscritos
          </div>
          {stats.profileChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">Sem dados.</p>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.profileChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {stats.profileChart.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => {
                      const n = typeof value === "number" ? value : Number(value ?? 0);
                      return [`${n} (${pct(n, stats.total)})`, "Inscritos"];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-secondary)]">
            {stats.profileChart.map((d) => (
              <li key={d.key} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}: <strong className="text-[var(--text-primary)]">{d.value}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Presença
          </div>
          {stats.presenceChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">Sem dados.</p>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.presenceChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {stats.presenceChart.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => {
                      const n = typeof value === "number" ? value : Number(value ?? 0);
                      return [`${n} (${pct(n, stats.total)})`, "Participantes"];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-secondary)]">
            {stats.presenceChart.map((d) => (
              <li key={d.key} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}: <strong className="text-[var(--text-primary)]">{d.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Cursos com mais participantes alunos
          </div>
          {stats.topCourses.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">
              Nenhum inscrito identificado como aluno com matrícula.
            </p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topCourses} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [value ?? 0, "Alunos"]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { fullName?: string } | undefined;
                      return row?.fullName ?? "";
                    }}
                  />
                  <Bar dataKey="count" fill="#059669" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Ranking de indicações
          </div>
          {stats.topReferrers.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">
              Nenhuma indicação registrada nesta ocorrência.
            </p>
          ) : (
            <ol className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {stats.topReferrers.map((r, idx) => {
                const width = Math.max(8, Math.round((r.total / (stats.topReferrers[0]?.total || 1)) * 100));
                return (
                  <li key={`${r.name}-${idx}`} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">
                        <span className="mr-1.5 text-xs text-[var(--text-muted)]">{idx + 1}.</span>
                        {r.name}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--text-secondary)]">
                        {r.total} ind. · {r.present} pres.
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--card-border)]">
                      <div
                        className="h-full rounded-full bg-violet-500/80"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-muted)]">
        E-mails: confirmação enviada em {stats.confirmationSent}/{stats.total} · lembrete em{" "}
        {stats.reminderSent}/{stats.total}. Aluno = vínculo com matrícula (conta, e-mail ou CPF).
      </p>
    </div>
  );
}
