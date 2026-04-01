"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";

import { SectionCard } from "@/components/dashboard/DashboardUI";
import type {
  DashboardHolidayCalendarItem,
  DashboardSessionCalendarItem,
} from "@/lib/dashboard-admin-calendar";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const DEFAULT_DESCRIPTION =
  "Sessões de turmas abertas ou em andamento, mais feriados e eventos institucionais. Clique em um dia para ver o detalhe; o período cobre vários meses a partir do mês atual.";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function groupHolidaysByDate(items: DashboardHolidayCalendarItem[]) {
  const m = new Map<string, DashboardHolidayCalendarItem[]>();
  for (const h of items) {
    const list = m.get(h.date) ?? [];
    list.push(h);
    m.set(h.date, list);
  }
  for (const [, list] of m) {
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "holiday" ? -1 : 1;
      const ta = a.startTime ?? "";
      const tb = b.startTime ?? "";
      return ta.localeCompare(tb) || a.name.localeCompare(b.name);
    });
  }
  return m;
}

export function AdminSessionsCalendar({
  sessions,
  holidays = [],
  description = DEFAULT_DESCRIPTION,
  footerHref = "/class-groups",
  footerLabel = "Gerir turmas →",
  /** Define links do rodapé e do detalhe de cada sessão (matrículas vs área do aluno vs professor). */
  audience = "admin",
  dataTour = "admin-dashboard-calendario",
}: {
  sessions: DashboardSessionCalendarItem[];
  holidays?: DashboardHolidayCalendarItem[];
  description?: string;
  footerHref?: string;
  footerLabel?: string;
  audience?: "admin" | "student" | "teacher";
  dataTour?: string;
}) {
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

  const byDateHolidays = useMemo(() => groupHolidaysByDate(holidays), [holidays]);

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
  const selectedHolidayItems = selectedYmd ? (byDateHolidays.get(selectedYmd) ?? []) : [];

  return (
    <SectionCard
      title="Calendário de aulas e institucional"
      description={description}
      dataTour={dataTour}
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
          href={footerHref}
          className="rounded text-sm font-semibold text-[var(--igh-primary)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--igh-primary)]"
        >
          {footerLabel}
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)] sm:text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--igh-primary)]" aria-hidden />
          Aulas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
          Feriado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-500" aria-hidden />
          Evento
        </span>
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
            return <div key={`pad-${i}`} className="min-h-[5.25rem] rounded-lg bg-[var(--igh-surface)]/20" aria-hidden />;
          }
          const daySessions = byDate.get(c.ymd) ?? [];
          const dayH = byDateHolidays.get(c.ymd) ?? [];
          const nSess = daySessions.length;
          const nHoliday = dayH.filter((h) => h.kind === "holiday").length;
          const nEvent = dayH.filter((h) => h.kind === "event").length;
          const hasAny = nSess > 0 || nHoliday > 0 || nEvent > 0;
          const selected = selectedYmd === c.ymd;

          const ringSession = nSess > 0;
          const ringHoliday = nHoliday > 0;
          const ringEvent = nEvent > 0;

          let cellClass =
            "flex min-h-[5.25rem] flex-col items-stretch gap-0.5 overflow-hidden rounded-lg border p-1 text-left transition sm:p-1.5 ";
          if (selected) {
            cellClass +=
              "border-[var(--igh-primary)] bg-[var(--igh-primary)]/15 ring-2 ring-[var(--igh-primary)]/30 ";
          } else if (hasAny) {
            cellClass +=
              "border-[var(--card-border)] bg-[var(--igh-surface)]/50 hover:border-[var(--igh-primary)]/40 hover:bg-[var(--igh-primary)]/5 ";
          } else {
            cellClass += "border-transparent bg-[var(--igh-surface)]/25 hover:bg-[var(--igh-surface)]/40 ";
          }

          return (
            <button
              key={c.ymd}
              type="button"
              onClick={() => setSelectedYmd((s) => (s === c.ymd ? null : c.ymd))}
              className={cellClass}
            >
              {hasAny && !selected ? (
                <div className="flex h-1 w-full shrink-0 gap-px" aria-hidden>
                  {ringSession ? <span className="h-full min-w-[3px] flex-1 bg-[var(--igh-primary)]" /> : null}
                  {ringHoliday ? <span className="h-full min-w-[3px] flex-1 bg-amber-500" /> : null}
                  {ringEvent ? <span className="h-full min-w-[3px] flex-1 bg-violet-500" /> : null}
                </div>
              ) : null}
              <span className="text-center text-sm font-bold tabular-nums text-[var(--text-primary)]">{c.day}</span>
              <div className="flex min-h-[2.5rem] flex-col items-center justify-center gap-0.5 text-[10px] leading-tight">
                {nSess > 0 ? (
                  <span className="font-semibold text-[var(--igh-primary)]">
                    {nSess} aula{nSess === 1 ? "" : "s"}
                  </span>
                ) : null}
                {nHoliday > 0 ? (
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    {nHoliday} feriado{nHoliday === 1 ? "" : "s"}
                  </span>
                ) : null}
                {nEvent > 0 ? (
                  <span className="font-semibold text-violet-700 dark:text-violet-400">
                    {nEvent} evento{nEvent === 1 ? "" : "s"}
                  </span>
                ) : null}
                {!hasAny ? <span className="text-[var(--text-muted)]">—</span> : null}
              </div>
            </button>
          );
        })}
      </div>

      {selectedYmd ? (
        <div
          className="mt-6 rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/40 p-4"
          role="region"
          aria-label={`Aulas e feriados em ${selectedYmd}`}
        >
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {new Date(selectedYmd + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          {selectedSessions.length === 0 && selectedHolidayItems.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Nenhuma sessão nem feriado/evento neste dia no período carregado — em outro mês use as setas ou confira o
              cadastro da turma.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {selectedSessions.length > 0 ? (
                <ul className="space-y-3">
                  {selectedSessions.map((s) => (
                    <li
                      key={s.sessionId}
                      className="rounded-lg border border-[var(--igh-primary)]/35 bg-[var(--card-bg)] px-3 py-3 sm:px-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--igh-primary)]">Aula</p>
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
                            href={
                              audience === "teacher"
                                ? `/professor/turmas/${s.classGroupId}`
                                : audience === "student"
                                  ? `/minhas-turmas/${s.classGroupId}/conteudo`
                                  : `/enrollments?turma=${s.classGroupId}`
                            }
                            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--igh-primary)] hover:underline"
                          >
                            <MapPin className="h-3.5 w-3.5" aria-hidden />
                            {audience === "teacher"
                              ? "Abrir turma"
                              : audience === "student"
                                ? "Conteúdo da turma"
                                : "Turma / matrículas"}
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {selectedHolidayItems.length > 0 ? (
                <ul className={`space-y-3 ${selectedSessions.length > 0 ? "border-t border-[var(--card-border)] pt-3" : ""}`}>
                  {selectedHolidayItems.map((h) => (
                    <li
                      key={h.id}
                      className={`rounded-lg border px-3 py-3 sm:px-4 ${
                        h.kind === "holiday"
                          ? "border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/25"
                          : "border-violet-500/40 bg-violet-50/80 dark:bg-violet-950/25"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-bold uppercase tracking-wide ${
                              h.kind === "holiday" ? "text-amber-800 dark:text-amber-400" : "text-violet-800 dark:text-violet-400"
                            }`}
                          >
                            {h.kind === "holiday" ? "Feriado" : "Evento"}
                          </p>
                          <p className="font-semibold text-[var(--text-primary)]">{h.name}</p>
                        </div>
                        {h.kind === "event" && h.startTime && h.endTime ? (
                          <span className="inline-flex items-center gap-1 tabular-nums text-sm text-[var(--text-primary)]">
                            <Clock
                              className={`h-4 w-4 ${h.kind === "event" ? "text-violet-600 dark:text-violet-400" : ""}`}
                              aria-hidden
                            />
                            {h.startTime} – {h.endTime}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)]">
                            <CalendarDays className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                            Dia inteiro
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          Selecione um dia com aulas, feriados ou eventos para ver o detalhe.
        </p>
      )}
    </SectionCard>
  );
}
