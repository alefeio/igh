"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Sparkles, Ticket } from "lucide-react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site/Button";
import type { ApiResponse } from "@/lib/api-types";
import type { PublicCalendarItem } from "@/lib/public-calendar-shared";
import {
  formatHm,
  formatPublicCalendarDate,
  publicCalendarLoginPath,
  publicCalendarSignupPath,
} from "@/lib/public-calendar-shared";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

type SessionUser = { name: string; email: string; role: string } | null;

type RegistrationKey = `${string}:${string}`;

function timeToMinutes(hm: string | null): number {
  if (!hm) return -1;
  const [h, m] = hm.slice(0, 5).split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

function sortCalendarItems(items: PublicCalendarItem[]): PublicCalendarItem[] {
  return [...items].sort((a, b) => {
    const aMin = timeToMinutes(a.startTime);
    const bMin = timeToMinutes(b.startTime);
    if (aMin !== bMin) return aMin - bMin;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function PublicIghCalendar({
  sessionUser,
  initialHolidayId,
  initialDate,
}: {
  sessionUser: SessionUser;
  initialHolidayId?: string;
  initialDate?: string;
}) {
  const toast = useToast();
  const [view, setView] = useState(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      const [y, m] = initialDate.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [items, setItems] = useState<PublicCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYmd, setSelectedYmd] = useState<string | null>(initialDate ?? null);
  const [focusedItem, setFocusedItem] = useState<PublicCalendarItem | null>(null);
  const [myRegistrations, setMyRegistrations] = useState<Set<RegistrationKey>>(new Set());
  const [registering, setRegistering] = useState(false);

  const year = view.getFullYear();
  const month = view.getMonth() + 1;

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/calendar?year=${year}&month=${month}`);
      const json = (await res.json()) as ApiResponse<{ items: PublicCalendarItem[] }>;
      if (res.ok && json.ok) setItems(json.data.items);
      else setItems([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const loadRegistrations = useCallback(async () => {
    if (!sessionUser) {
      setMyRegistrations(new Set());
      return;
    }
    const from = `${year}-${pad2(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${pad2(month)}-${pad2(lastDay)}`;
    try {
      const res = await fetch(`/api/me/holiday-events/registrations?from=${from}&to=${to}`, {
        credentials: "include",
      });
      const json = (await res.json()) as ApiResponse<{
        registrations: { holidayId: string; occurrenceDate: string }[];
      }>;
      if (res.ok && json.ok) {
        setMyRegistrations(
          new Set(json.data.registrations.map((r) => `${r.holidayId}:${r.occurrenceDate}` as RegistrationKey))
        );
      }
    } catch {
      /* ignore */
    }
  }, [sessionUser, year, month]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    void loadRegistrations();
  }, [loadRegistrations]);

  useEffect(() => {
    if (!initialHolidayId || !initialDate || items.length === 0) return;
    const match = items.find((i) => i.holidayId === initialHolidayId && i.date === initialDate);
    if (match) {
      setSelectedYmd(initialDate);
      setFocusedItem(match);
    }
  }, [initialHolidayId, initialDate, items]);

  const byDate = useMemo(() => {
    const m = new Map<string, PublicCalendarItem[]>();
    for (const item of items) {
      const list = m.get(item.date) ?? [];
      list.push(item);
      m.set(item.date, list);
    }
    for (const [date, list] of m) {
      m.set(date, sortCalendarItems(list));
    }
    return m;
  }, [items]);

  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: { day: number; inMonth: boolean; ymd: string }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: 0, inMonth: false, ymd: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, ymd: `${year}-${pad2(month)}-${pad2(d)}` });
  }
  while (cells.length % 7 !== 0) cells.push({ day: 0, inMonth: false, ymd: "" });

  const monthLabel = view.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const selectedItems = selectedYmd ? (byDate.get(selectedYmd) ?? []) : [];

  const isRegistered = (item: PublicCalendarItem) =>
    myRegistrations.has(`${item.holidayId}:${item.date}` as RegistrationKey);

  const register = async (item: PublicCalendarItem) => {
    if (!sessionUser) return;
    setRegistering(true);
    try {
      const res = await fetch(`/api/me/holiday-events/${item.holidayId}/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceDate: item.date }),
      });
      const json = (await res.json()) as ApiResponse<{ message?: string }>;
      if (res.ok && json.ok) {
        toast.push("success", json.data.message ?? "Inscrição confirmada.");
        await loadRegistrations();
      } else {
        toast.push("error", json.ok ? "Não foi possível inscrever." : json.error.message);
      }
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div
      className={
        selectedYmd
          ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,22rem)] lg:items-start"
          : "w-full"
      }
    >
      <div className="w-full min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--igh-border)] bg-white hover:bg-[var(--igh-surface)]"
              aria-label="Mês anterior"
              onClick={() => {
                setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1));
                setSelectedYmd(null);
                setFocusedItem(null);
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="min-w-[10rem] text-center text-lg font-semibold capitalize text-[var(--igh-secondary)]">
              {monthLabel}
            </h2>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--igh-border)] bg-white hover:bg-[var(--igh-surface)]"
              aria-label="Próximo mês"
              onClick={() => {
                setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1));
                setSelectedYmd(null);
                setFocusedItem(null);
              }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--igh-muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Feriado
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Evento
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--igh-primary)]" /> Inscrições abertas
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[var(--igh-muted)]">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-[var(--igh-muted)]">Carregando calendário…</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {cells.map((cell, idx) => {
              if (!cell.inMonth) return <div key={`empty-${idx}`} className="min-h-[5.5rem] sm:min-h-[6.5rem]" />;
              const dayItems = byDate.get(cell.ymd) ?? [];
              const isSelected = selectedYmd === cell.ymd;
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  onClick={() => {
                    setSelectedYmd(cell.ymd);
                    setFocusedItem(dayItems[0] ?? null);
                  }}
                  className={`flex min-h-[5.5rem] flex-col rounded-lg border p-1.5 text-left transition sm:min-h-[6.5rem] sm:p-2 ${
                    isSelected
                      ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10 ring-2 ring-[var(--igh-primary)]/30"
                      : "border-[var(--igh-border)] bg-white hover:border-[var(--igh-primary)]/40"
                  }`}
                >
                  <span className="text-sm font-semibold text-[var(--igh-secondary)]">{cell.day}</span>
                  <ul className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                    {dayItems.length === 0 ? (
                      <li className="flex-1" aria-hidden />
                    ) : (
                      dayItems.map((item) => (
                        <li
                          key={item.id}
                          className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight sm:text-[11px] ${
                            item.allowsRegistration
                              ? "bg-[var(--igh-primary)]/15 font-medium text-[var(--igh-primary)]"
                              : item.kind === "event"
                                ? "bg-amber-50 font-medium text-amber-900"
                                : "bg-slate-100 text-slate-700"
                          }`}
                          title={item.name}
                        >
                          {item.name}
                        </li>
                      ))
                    )}
                  </ul>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedYmd ? (
        <aside className="rounded-2xl border border-[var(--igh-border)] bg-white p-5 shadow-sm lg:sticky lg:top-4">
          {selectedItems.length === 0 ? (
            <p className="text-sm text-[var(--igh-muted)]">Nenhum feriado ou evento neste dia.</p>
          ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold capitalize text-[var(--igh-secondary)]">
                {new Date(selectedYmd + "T12:00:00").toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <button
                type="button"
                className="shrink-0 text-xs text-[var(--igh-muted)] underline hover:text-[var(--igh-secondary)]"
                onClick={() => {
                  setSelectedYmd(null);
                  setFocusedItem(null);
                }}
              >
                Fechar
              </button>
            </div>
            <ul className="flex flex-col gap-3">
              {selectedItems.map((item) => {
                const active = focusedItem?.id === item.id;
                const registered = isRegistered(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setFocusedItem(item)}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        active
                          ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/5"
                          : "border-[var(--igh-border)] hover:border-[var(--igh-primary)]/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.kind === "holiday"
                              ? "bg-slate-100 text-slate-700"
                              : item.allowsRegistration
                                ? "bg-[var(--igh-primary)]/10 text-[var(--igh-primary)]"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.kind === "holiday"
                            ? "Feriado"
                            : item.allowsRegistration
                              ? "Evento · inscrições"
                              : "Evento"}
                        </span>
                        {registered && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Inscrito
                          </span>
                        )}
                      </div>
                      <p className="mt-2 font-semibold text-[var(--igh-secondary)]">{item.name}</p>
                      {item.startTime && item.endTime && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--igh-muted)]">
                          <Clock className="h-3.5 w-3.5" />
                          {formatHm(item.startTime)} – {formatHm(item.endTime)}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {focusedItem && (
              <div className="rounded-xl border border-dashed border-[var(--igh-border)] bg-[var(--igh-surface)]/60 p-4">
                <h4 className="font-semibold text-[var(--igh-secondary)]">{focusedItem.name}</h4>
                <p className="mt-1 text-xs text-[var(--igh-muted)]">
                  {formatPublicCalendarDate(focusedItem.date, focusedItem.recurring)}
                  {focusedItem.startTime && focusedItem.endTime
                    ? ` · ${formatHm(focusedItem.startTime)} – ${formatHm(focusedItem.endTime)}`
                    : ""}
                </p>
                {focusedItem.publicDescription && (
                  <p className="mt-3 text-sm text-[var(--igh-muted)]">{focusedItem.publicDescription}</p>
                )}

                {focusedItem.allowsRegistration ? (
                  <div className="mt-4 flex flex-col gap-2">
                    {sessionUser ? (
                      isRegistered(focusedItem) ? (
                        <p className="text-sm text-emerald-700">
                          <Sparkles className="mr-1 inline h-4 w-4" />
                          Você já está inscrito. Confira seu e-mail para os detalhes.
                        </p>
                      ) : (
                        <Button type="button" disabled={registering} onClick={() => void register(focusedItem)}>
                          <Ticket className="mr-2 h-4 w-4" />
                          {registering ? "Inscrevendo…" : "Inscrever-me neste evento"}
                        </Button>
                      )
                    ) : (
                      <>
                        <p className="text-sm text-[var(--igh-muted)]">
                          Entre ou crie sua conta gratuita para se inscrever.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button as="link" href={publicCalendarLoginPath(focusedItem.holidayId, focusedItem.date)}>
                            Entrar
                          </Button>
                          <Button
                            as="link"
                            variant="secondary"
                            href={publicCalendarSignupPath(focusedItem.holidayId, focusedItem.date)}
                          >
                            Criar conta
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : focusedItem.kind === "holiday" ? (
                  <p className="mt-3 text-sm text-[var(--igh-muted)]">Feriado institucional — sem aulas neste dia.</p>
                ) : (
                  <p className="mt-3 text-sm text-[var(--igh-muted)]">Evento informativo — inscrições não disponíveis.</p>
                )}
              </div>
            )}
          </div>
        )}

          {sessionUser && (
            <p className="mt-6 border-t border-[var(--igh-border)] pt-4 text-xs text-[var(--igh-muted)]">
              Conectado como <strong>{sessionUser.name}</strong>
            </p>
          )}
        </aside>
      ) : null}
    </div>
  );
}
