"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";

import { SectionCard } from "@/components/dashboard/DashboardUI";
import type { DashboardSessionCalendarItem } from "@/lib/dashboard-admin-calendar";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function AdminSessionsCalendar({ sessions }: { sessions: DashboardSessionCalendarItem[] }) {
  const byDate = useMemo(() => {
    const m = new Map<string, DashboardSessionCalendarItem[]>();
    for (const s of sessions) {
      const list = m.get(s.sessionDate) ?? [];
      list.push(s);
      m.set(s.sessionDate, list);
    }
    for (const [, list] of m) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return m;
  }, [sessions]);

  const [view, setView] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);

  const year = view.getFullYear();
  const month = view.getMonth();

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: { day: number; inMonth: boolean; ymd: string }[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ day: 0, inMonth: false, ymd: "" });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    cells.push({ day: d, inMonth: true, ymd });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: 0, inMonth: false, ymd: "" });
  }

  const monthLabel = view.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const selectedSessions = selectedYmd ? (byDate.get(selectedYmd) ?? []) : [];

  return (
    <SectionCard
      title="Aulas no calendário"
      description="Sessões de turmas abertas ou em andamento. Clique em um dia para listar as aulas; o período carregado cobre vários meses a partir do mês atual."
      dataTour="admin-dashboard-calendario"
      variant="elevated"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-primary)] transition hover:bg-[var(--igh-primary)]/10"
            aria-label="Mês anterior"
            onClick={() => {
              setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1));
              setSelectedYmd(null);
            }}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <h3 className="min-w-[10rem] text-center text-base font-semibold capitalize text-[var(--text-primary)] sm:min-w-[12rem]">
            {monthLabel}
          </h3>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] text-[var(--text-primary)] transition hover:bg-[var(--igh-primary)]/10"
            aria-label="Próximo mês"
            onClick={() => {
              setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1));
              setSelectedYmd(null);
            }}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <Link
          href="/class-groups"
          className="text-sm font-semibold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)] rounded"
        >
          Gerir turmas →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 border-b border-[var(--card-border)] pb-2 text-center text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] sm:text-xs">
        {WEEKDAYS.map((w) => (
          <div key={w}>
            {w}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.inMonth) {
            return <div key={`pad-${i}`} className="min-h-[4.5rem] rounded-lg bg-[var(--igh-surface)]/20" aria-hidden />;
          }
          const n = byDate.get(c.ymd)?.length ?? 0;
          const selected = selectedYmd === c.ymd;
          return (
            <button
              key={c.ymd}
              type="button"
              onClick={() => setSelectedYmd((s) => (s === c.ymd ? null : c.ymd))}
              className={`flex min-h-[4.5rem] flex-col items-center gap-0.5 rounded-lg border p-1.5 text-left transition sm:p-2 ${
                selected
                  ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/15 ring-2 ring-[var(--igh-primary)]/30"
                  : n > 0
                    ? "border-[var(--card-border)] bg-[var(--igh-surface)]/50 hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5"
                    : "border-transparent bg-[var(--igh-surface)]/25 hover:bg-[var(--igh-surface)]/40"
              }`}
            >
              <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{c.day}</span>
              {n > 0 ? (
                <span className="text-center text-[10px] font-semibold leading-tight text-[var(--igh-primary)]">
                  {n} aula{n === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-[10px] text-[var(--text-muted)]">—</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedYmd ? (
        <div
          className="mt-6 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/40 p-4"
          role="region"
          aria-label={`Aulas em ${selectedYmd}`}
        >
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {new Date(selectedYmd + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          {selectedSessions.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Nenhuma sessão neste dia no período carregado — em outro mês use as setas ou confira o cadastro da turma.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {selectedSessions.map((s) => (
                <li
                  key={s.sessionId}
                  className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-3 sm:px-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-primary)]">{s.courseName}</p>
                      <p className="text-sm text-[var(--text-muted)]">{s.teacherName}</p>
                      {s.lessonTitle ? (
                        <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{s.lessonTitle}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                      <span className="inline-flex items-center gap-1 tabular-nums text-[var(--text-primary)]">
                        <Clock className="h-4 w-4 text-[var(--igh-primary)]" aria-hidden />
                        {s.startTime} – {s.endTime}
                      </span>
                      <Link
                        href={`/enrollments?turma=${s.classGroupId}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[var(--igh-primary)] hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        Turma / matrículas
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">Selecione um dia com aulas para ver o detalhe.</p>
      )}
    </SectionCard>
  );
}
