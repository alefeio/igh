"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, Share2, Sparkles, Ticket, X } from "lucide-react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/site/Button";
import type { ApiResponse } from "@/lib/api-types";
import type { PublicCalendarItem } from "@/lib/public-calendar-shared";
import {
  buildPublicCalendarPath,
  formatHm,
  formatPublicCalendarDate,
  parsePublicCalendarSearchParams,
  publicCalendarLoginPath,
  publicCalendarSignupPath,
  subtitlesMatch,
  type PublicCalendarUrlState,
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

function ItemTitleBlock({
  item,
  size = "card",
  onSubtitleClick,
}: {
  item: PublicCalendarItem;
  size?: "card" | "detail";
  onSubtitleClick?: (subtitle: string) => void;
}) {
  return (
    <div>
      <p
        className={
          size === "detail"
            ? "text-base font-semibold text-[var(--igh-secondary)]"
            : "font-semibold text-[var(--igh-secondary)]"
        }
      >
        {item.name}
      </p>
      {item.subtitle ? (
        onSubtitleClick ? (
          <button
            type="button"
            onClick={() => onSubtitleClick(item.subtitle!)}
            className="mt-1 inline-flex max-w-full rounded-full border border-[var(--igh-border)] bg-[var(--igh-surface)] px-2 py-0.5 text-left text-xs font-normal text-[var(--igh-muted)] transition hover:border-[var(--igh-primary)]/50 hover:text-[var(--igh-primary)]"
          >
            {item.subtitle}
          </button>
        ) : (
          <p className="mt-0.5 text-xs font-normal text-[var(--igh-muted)]">{item.subtitle}</p>
        )
      ) : null}
    </div>
  );
}

function CalendarItemDetail({
  item,
  sessionUser,
  registered,
  registering,
  onRegister,
  onSubtitleClick,
}: {
  item: PublicCalendarItem;
  sessionUser: SessionUser;
  registered: boolean;
  registering: boolean;
  onRegister: (item: PublicCalendarItem) => void;
  onSubtitleClick?: (subtitle: string) => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--igh-border)] bg-[var(--igh-surface)]/60 p-4">
      <ItemTitleBlock item={item} size="detail" onSubtitleClick={onSubtitleClick} />
      <p className="mt-2 text-xs text-[var(--igh-muted)]">
        {formatPublicCalendarDate(item.date, item.recurring)}
        {item.startTime && item.endTime ? ` · ${formatHm(item.startTime)} – ${formatHm(item.endTime)}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
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
      {item.publicDescription && (
        <p className="mt-3 text-sm text-[var(--igh-muted)]">{item.publicDescription}</p>
      )}

      {item.allowsRegistration ? (
        <div className="mt-4 flex flex-col gap-2">
          {sessionUser ? (
            registered ? (
              <p className="text-sm text-emerald-700">
                <Sparkles className="mr-1 inline h-4 w-4" />
                Você já está inscrito. Confira seu e-mail para os detalhes.
              </p>
            ) : (
              <Button type="button" disabled={registering} onClick={() => onRegister(item)}>
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
                <Button as="link" href={publicCalendarLoginPath(item.holidayId, item.date)}>
                  Entrar
                </Button>
                <Button
                  as="link"
                  variant="secondary"
                  href={publicCalendarSignupPath(item.holidayId, item.date)}
                >
                  Criar conta
                </Button>
              </div>
            </>
          )}
        </div>
      ) : item.kind === "holiday" ? (
        <p className="mt-3 text-sm text-[var(--igh-muted)]">Feriado institucional — sem aulas neste dia.</p>
      ) : (
        <p className="mt-3 text-sm text-[var(--igh-muted)]">Evento informativo — inscrições não disponíveis.</p>
      )}
    </div>
  );
}

function formatDayHeading(ymd: string): string {
  return new Date(ymd + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function eventKindClass(item: PublicCalendarItem): string {
  if (item.allowsRegistration) {
    return "bg-[var(--igh-primary)]/15 font-medium text-[var(--igh-primary)]";
  }
  if (item.kind === "event") {
    return "bg-amber-50 font-medium text-amber-900";
  }
  return "bg-slate-100 text-slate-700";
}

function DayEventsSection({
  date,
  items,
  activeItemId,
  sessionUser,
  registering,
  isRegistered,
  onSelect,
  onRegister,
  onSubtitleClick,
  onClose,
  sectionId,
}: {
  date: string;
  items: PublicCalendarItem[];
  activeItemId: string | null;
  sessionUser: SessionUser;
  registering: boolean;
  isRegistered: (item: PublicCalendarItem) => boolean;
  onSelect: (item: PublicCalendarItem) => void;
  onRegister: (item: PublicCalendarItem) => void;
  onSubtitleClick: (subtitle: string) => void;
  onClose?: () => void;
  sectionId?: string;
}) {
  return (
    <section id={sectionId} className="scroll-mt-4">
      <div className="flex items-start justify-between gap-2 border-b border-[var(--igh-border)] pb-2">
        <h3 className="text-base font-semibold capitalize text-[var(--igh-secondary)] sm:text-lg">
          {formatDayHeading(date)}
        </h3>
        {onClose ? (
          <button
            type="button"
            className="shrink-0 text-xs text-[var(--igh-muted)] underline hover:text-[var(--igh-secondary)]"
            onClick={onClose}
          >
            Fechar
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--igh-muted)]">Nenhum feriado ou evento neste dia.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {items.map((item) => (
            <FilteredEventListItem
              key={item.id}
              item={item}
              active={activeItemId === item.id}
              registered={isRegistered(item)}
              sessionUser={sessionUser}
              registering={registering}
              onSelect={() => onSelect(item)}
              onRegister={onRegister}
              onSubtitleClick={onSubtitleClick}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FilteredEventListItem({
  item,
  active,
  registered,
  sessionUser,
  registering,
  onSelect,
  onRegister,
  onSubtitleClick,
}: {
  item: PublicCalendarItem;
  active: boolean;
  registered: boolean;
  sessionUser: SessionUser;
  registering: boolean;
  onSelect: () => void;
  onRegister: (item: PublicCalendarItem) => void;
  onSubtitleClick: (subtitle: string) => void;
}) {
  return (
    <li className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-xl border p-4 text-left transition ${
          active
            ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/5"
            : "border-[var(--igh-border)] bg-white hover:border-[var(--igh-primary)]/40"
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
          {item.startTime && item.endTime ? (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--igh-muted)]">
              <Clock className="h-3.5 w-3.5" />
              {formatHm(item.startTime)} – {formatHm(item.endTime)}
            </span>
          ) : null}
        </div>
        <div className="mt-2">
          <ItemTitleBlock item={item} onSubtitleClick={onSubtitleClick} />
        </div>
      </button>
      {active ? (
        <CalendarItemDetail
          item={item}
          sessionUser={sessionUser}
          registered={registered}
          registering={registering}
          onRegister={onRegister}
          onSubtitleClick={onSubtitleClick}
        />
      ) : null}
    </li>
  );
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlFromParams = parsePublicCalendarSearchParams(searchParams);
  const bootDate =
    urlFromParams.date ??
    (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : null);
  const bootEventId = urlFromParams.eventId ?? initialHolidayId ?? null;
  const subtitleFilter = urlFromParams.subtitle;

  const [view, setView] = useState(() => {
    if (bootDate) {
      const [y, m] = bootDate.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [items, setItems] = useState<PublicCalendarItem[]>([]);
  const [subtitleTags, setSubtitleTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYmd, setSelectedYmd] = useState<string | null>(bootDate);
  const [focusedItem, setFocusedItem] = useState<PublicCalendarItem | null>(null);
  const [myRegistrations, setMyRegistrations] = useState<Set<RegistrationKey>>(new Set());
  const [registering, setRegistering] = useState(false);
  const [sharing, setSharing] = useState(false);

  const readUrlState = useCallback(
    (): PublicCalendarUrlState => parsePublicCalendarSearchParams(searchParams),
    [searchParams]
  );

  const updateUrl = useCallback(
    (patch: Partial<PublicCalendarUrlState>) => {
      const next: PublicCalendarUrlState = { ...readUrlState(), ...patch };
      const path = buildPublicCalendarPath(next);
      const currentQs = searchParams.toString();
      const current = currentQs ? `${pathname}?${currentQs}` : pathname;
      if (path !== current) router.replace(path, { scroll: false });
    },
    [pathname, router, readUrlState, searchParams]
  );

  const clearDaySelection = useCallback(() => {
    setSelectedYmd(null);
    setFocusedItem(null);
    const { subtitle } = readUrlState();
    updateUrl({ date: null, eventId: null, subtitle });
  }, [readUrlState, updateUrl]);

  const clearSubtitleFilter = useCallback(() => {
    updateUrl({ subtitle: null, date: null, eventId: null });
    setSelectedYmd(null);
    setFocusedItem(null);
  }, [updateUrl]);

  const toggleSubtitleFilter = useCallback(
    (tag: string) => {
      const { subtitle } = readUrlState();
      const nextSubtitle = subtitlesMatch(subtitle, tag) ? null : tag;
      setSelectedYmd(null);
      setFocusedItem(null);
      updateUrl({ subtitle: nextSubtitle, date: null, eventId: null });
    },
    [readUrlState, updateUrl]
  );

  const resolveFocusedItem = useCallback(
    (dayItems: PublicCalendarItem[], preferredHolidayId?: string | null) => {
      if (preferredHolidayId) {
        return dayItems.find((i) => i.holidayId === preferredHolidayId) ?? null;
      }
      if (dayItems.length === 1) return dayItems[0];
      return null;
    },
    []
  );

  const selectDay = useCallback(
    (ymd: string, dayItems: PublicCalendarItem[], preferredHolidayId?: string | null) => {
      setSelectedYmd(ymd);
      const match = resolveFocusedItem(dayItems, preferredHolidayId);
      setFocusedItem(match);
      const { subtitle } = readUrlState();
      updateUrl({ date: ymd, eventId: match?.holidayId ?? null, subtitle });
    },
    [readUrlState, resolveFocusedItem, updateUrl]
  );

  const selectEvent = useCallback(
    (item: PublicCalendarItem) => {
      setSelectedYmd(item.date);
      setFocusedItem(item);
      const { subtitle } = readUrlState();
      updateUrl({ date: item.date, eventId: item.holidayId, subtitle });
    },
    [readUrlState, updateUrl]
  );

  const shareCalendar = async () => {
    setSharing(true);
    try {
      const url = window.location.href;
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Calendário IGH",
            text: "Confira o calendário de eventos do Instituto Gustavo Hessel.",
            url,
          });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(url);
      toast.push("success", "Link do calendário copiado para a área de transferência.");
    } catch {
      toast.push("error", "Não foi possível copiar o link. Copie a URL da barra de endereços.");
    } finally {
      setSharing(false);
    }
  };

  const year = view.getFullYear();
  const month = view.getMonth() + 1;

  const isListMode = !!subtitleFilter;

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const url = isListMode
        ? `/api/public/calendar?subtitle=${encodeURIComponent(subtitleFilter!)}`
        : `/api/public/calendar?year=${year}&month=${month}`;
      const res = await fetch(url);
      const json = (await res.json()) as ApiResponse<{ items: PublicCalendarItem[]; subtitleTags?: string[] }>;
      if (res.ok && json.ok) {
        setItems(json.data.items);
        setSubtitleTags(json.data.subtitleTags ?? []);
      } else {
        setItems([]);
        setSubtitleTags([]);
      }
    } finally {
      setLoading(false);
    }
  }, [year, month, isListMode, subtitleFilter]);

  const loadRegistrations = useCallback(async () => {
    if (!sessionUser) {
      setMyRegistrations(new Set());
      return;
    }
    const now = new Date();
    const from = isListMode
      ? `${now.getFullYear() - 1}-01-01`
      : `${year}-${pad2(month)}-01`;
    const lastDay = isListMode ? 31 : new Date(year, month, 0).getDate();
    const to = isListMode
      ? `${now.getFullYear() + 1}-12-31`
      : `${year}-${pad2(month)}-${pad2(lastDay)}`;
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
  }, [sessionUser, year, month, isListMode]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    void loadRegistrations();
  }, [loadRegistrations]);

  const filteredItems = useMemo(() => {
    if (!subtitleFilter) return items;
    return items.filter((item) => subtitlesMatch(item.subtitle, subtitleFilter));
  }, [items, subtitleFilter]);

  const byDate = useMemo(() => {
    const m = new Map<string, PublicCalendarItem[]>();
    for (const item of filteredItems) {
      const list = m.get(item.date) ?? [];
      list.push(item);
      m.set(item.date, list);
    }
    for (const [date, list] of m) {
      m.set(date, sortCalendarItems(list));
    }
    return m;
  }, [filteredItems]);

  useEffect(() => {
    const { date, eventId } = parsePublicCalendarSearchParams(searchParams);
    if (!date) {
      setSelectedYmd(null);
      setFocusedItem(null);
      return;
    }
    const [y, m] = date.split("-").map(Number);
    setView((prev) => {
      const next = new Date(y, m - 1, 1);
      return prev.getFullYear() === next.getFullYear() && prev.getMonth() === next.getMonth() ? prev : next;
    });
    setSelectedYmd(date);
    const dayItems = byDate.get(date) ?? [];
    const match = resolveFocusedItem(dayItems, eventId);
    setFocusedItem(match);
  }, [searchParams, byDate, resolveFocusedItem]);

  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: { day: number; inMonth: boolean; ymd: string }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: 0, inMonth: false, ymd: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, ymd: `${year}-${pad2(month)}-${pad2(d)}` });
  }
  while (cells.length % 7 !== 0) cells.push({ day: 0, inMonth: false, ymd: "" });
  const inMonthCells = cells.filter((c) => c.inMonth);

  const todayYmd = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
  }, []);

  const monthLabel = view.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const visibleSubtitleTags = useMemo(() => {
    if (!subtitleFilter) return subtitleTags;
    const has = subtitleTags.some((t) => subtitlesMatch(t, subtitleFilter));
    if (has) return subtitleTags;
    return [...subtitleTags, subtitleFilter].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [subtitleTags, subtitleFilter]);
  const selectedItems = selectedYmd ? (byDate.get(selectedYmd) ?? []) : [];
  const activeItem = focusedItem;
  const listDays = useMemo(
    () =>
      [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayItems]) => ({ date, items: dayItems })),
    [byDate]
  );

  const isRegistered = (item: PublicCalendarItem) =>
    myRegistrations.has(`${item.holidayId}:${item.date}` as RegistrationKey);

  useEffect(() => {
    if (isListMode || loading || selectedYmd || bootDate) return;
    const viewingCurrentMonth =
      view.getFullYear() === new Date().getFullYear() && view.getMonth() === new Date().getMonth();
    if (!viewingCurrentMonth) return;
    const dayItems = byDate.get(todayYmd) ?? [];
    selectDay(todayYmd, dayItems);
  }, [isListMode, loading, selectedYmd, bootDate, view, todayYmd, byDate, selectDay]);

  useEffect(() => {
    if (isListMode || !selectedYmd) return;
    document
      .getElementById(`cal-chip-${selectedYmd}`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    const el = document.getElementById(`cal-day-${selectedYmd}`);
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [isListMode, selectedYmd, focusedItem?.id]);

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
    <div className="w-full">
      <div className="w-full min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {isListMode ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--igh-primary)]">
                Listagem filtrada
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--igh-secondary)]">{subtitleFilter}</h2>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--igh-border)] bg-white hover:bg-[var(--igh-surface)]"
                aria-label="Mês anterior"
                onClick={() => {
                  setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1));
                  clearDaySelection();
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
                  clearDaySelection();
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={sharing}
              onClick={() => void shareCalendar()}
              className="inline-flex items-center gap-1.5"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              {sharing ? "Copiando…" : "Compartilhar"}
            </Button>
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
        </div>

        {(visibleSubtitleTags.length > 0 || subtitleFilter) ? (
          <div className="mb-4 rounded-xl border border-[var(--igh-border)] bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--igh-muted)]">
                Filtrar por subtítulo
              </p>
              {subtitleFilter ? (
                <button
                  type="button"
                  onClick={clearSubtitleFilter}
                  className="inline-flex items-center gap-1 text-xs text-[var(--igh-primary)] hover:underline"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Limpar filtro
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {visibleSubtitleTags.map((tag) => {
                const active = subtitlesMatch(subtitleFilter, tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleSubtitleFilter(tag)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                        : "border-[var(--igh-border)] bg-[var(--igh-surface)] text-[var(--igh-secondary)] hover:border-[var(--igh-primary)]/50"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            {subtitleFilter ? (
              <p className="mt-2 text-xs text-[var(--igh-muted)]">
                Eventos agrupados por dia, em ordem cronológica.
              </p>
            ) : null}
          </div>
        ) : null}

        {isListMode ? (
          loading ? (
            <p className="py-12 text-center text-sm text-[var(--igh-muted)]">Carregando eventos…</p>
          ) : listDays.length === 0 ? (
            <p className="rounded-xl border border-[var(--igh-border)] bg-white py-12 text-center text-sm text-[var(--igh-muted)]">
              Nenhum evento encontrado com este subtítulo no período exibido.
            </p>
          ) : (
            <div className="flex flex-col gap-8">
              {listDays.map(({ date, items: dayItems }) => (
                <section key={date}>
                  <h3 className="border-b border-[var(--igh-border)] pb-2 text-base font-semibold capitalize text-[var(--igh-secondary)]">
                    {formatDayHeading(date)}
                  </h3>
                  <ul className="mt-4 flex flex-col gap-4">
                    {dayItems.map((item) => (
                      <FilteredEventListItem
                        key={item.id}
                        item={item}
                        active={activeItem?.id === item.id}
                        registered={isRegistered(item)}
                        sessionUser={sessionUser}
                        registering={registering}
                        onSelect={() => selectEvent(item)}
                        onRegister={(ev) => void register(ev)}
                        onSubtitleClick={toggleSubtitleFilter}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Mobile: seletor de dias em chips (substitui a grade 7 colunas) */}
            <div className="md:hidden">
              {loading ? (
                <p className="py-8 text-center text-sm text-[var(--igh-muted)]">Carregando calendário…</p>
              ) : (
                <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--igh-muted)]">
                Selecione um dia
              </p>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
                {inMonthCells.map((cell) => {
                  const dayItems = byDate.get(cell.ymd) ?? [];
                  const hasEvents = dayItems.length > 0;
                  const isSelected = selectedYmd === cell.ymd;
                  const isToday = cell.ymd === todayYmd;
                  const weekday = new Date(cell.ymd + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "narrow",
                  });
                  return (
                    <button
                      key={cell.ymd}
                      id={`cal-chip-${cell.ymd}`}
                      type="button"
                      onClick={() => selectDay(cell.ymd, dayItems)}
                      className={`flex min-w-[3.25rem] shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-center transition ${
                        isSelected
                          ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10 ring-2 ring-[var(--igh-primary)]/25"
                          : isToday
                            ? "border-[var(--igh-primary)]/40 bg-white"
                            : "border-[var(--igh-border)] bg-white hover:border-[var(--igh-primary)]/40"
                      }`}
                      aria-pressed={isSelected}
                      aria-label={`${cell.day}, ${weekday}${hasEvents ? ", com eventos" : ""}`}
                    >
                      <span className="text-[10px] font-medium uppercase text-[var(--igh-muted)]">
                        {weekday}
                      </span>
                      <span className="text-base font-semibold text-[var(--igh-secondary)]">{cell.day}</span>
                      <span
                        className={`mt-1 h-1.5 w-1.5 rounded-full ${
                          hasEvents ? "bg-[var(--igh-primary)]" : "bg-transparent"
                        }`}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
                </>
              )}
            </div>

            {/* Desktop: grade mensal */}
            <div className="hidden md:block">
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
                <div className="grid grid-cols-7 gap-2">
                  {cells.map((cell, idx) => {
                    if (!cell.inMonth) {
                      return <div key={`empty-${idx}`} className="min-h-[6.5rem]" />;
                    }
                    const dayItems = byDate.get(cell.ymd) ?? [];
                    const isSelected = selectedYmd === cell.ymd;
                    const isToday = cell.ymd === todayYmd;
                    return (
                      <div
                        key={cell.ymd}
                        className={`flex min-h-[6.5rem] flex-col rounded-lg border p-2 transition ${
                          isSelected
                            ? "border-[var(--igh-primary)] bg-[var(--igh-primary)]/10 ring-2 ring-[var(--igh-primary)]/30"
                            : isToday
                              ? "border-[var(--igh-primary)]/40 bg-white"
                              : "border-[var(--igh-border)] bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => selectDay(cell.ymd, dayItems)}
                          className="flex w-full items-center justify-between text-left"
                          aria-pressed={isSelected}
                        >
                          <span className="text-sm font-semibold text-[var(--igh-secondary)]">{cell.day}</span>
                          {dayItems.length > 0 ? (
                            <span className="rounded-full bg-[var(--igh-primary)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--igh-primary)]">
                              {dayItems.length}
                            </span>
                          ) : null}
                        </button>
                        <ul className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                          {dayItems.length === 0 ? (
                            <li className="flex-1" aria-hidden />
                          ) : (
                            dayItems.map((item) => {
                              const isActive = activeItem?.id === item.id;
                              return (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    onClick={() => selectEvent(item)}
                                    className={`w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight transition ${eventKindClass(item)} ${
                                      isActive ? "ring-1 ring-[var(--igh-primary)]" : "hover:opacity-90"
                                    }`}
                                    title={item.subtitle ? `${item.name} — ${item.subtitle}` : item.name}
                                  >
                                    <span className="block truncate">{item.name}</span>
                                  </button>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {loading ? null : selectedYmd ? (
              <div className="mt-6 rounded-2xl border border-[var(--igh-border)] bg-white p-4 sm:p-5">
                <DayEventsSection
                  sectionId={`cal-day-${selectedYmd}`}
                  date={selectedYmd}
                  items={selectedItems}
                  activeItemId={activeItem?.id ?? null}
                  sessionUser={sessionUser}
                  registering={registering}
                  isRegistered={isRegistered}
                  onSelect={selectEvent}
                  onRegister={(item) => void register(item)}
                  onSubtitleClick={toggleSubtitleFilter}
                  onClose={clearDaySelection}
                />
              </div>
            ) : (
              <p className="mt-6 rounded-xl border border-dashed border-[var(--igh-border)] bg-[var(--igh-surface)]/40 px-4 py-8 text-center text-sm text-[var(--igh-muted)]">
                Selecione um dia para ver os eventos e detalhes.
              </p>
            )}
          </>
        )}
      </div>

      {sessionUser && !isListMode ? (
        <p className="mt-4 text-center text-xs text-[var(--igh-muted)] md:text-left">
          Conectado como <strong>{sessionUser.name}</strong>
        </p>
      ) : null}
    </div>
  );
}
