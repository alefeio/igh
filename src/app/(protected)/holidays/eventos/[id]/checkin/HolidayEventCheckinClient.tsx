"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Gift,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  HolidayEventSummaryDashboard,
  type EventSummaryRegistration,
} from "@/components/holidays/HolidayEventSummaryDashboard";
import { RaffleDrawPanel, type RaffleItem } from "@/components/holidays/RaffleDrawPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import { BRAND } from "@/lib/brand";

type StudentLink = EventSummaryRegistration["studentLink"];

type CheckinRegistration = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  checkinCode: string | null;
  isGuest: boolean;
  present: boolean | null;
  attendanceMarkedAt: string | null;
  raffleNumber: number | null;
  referrerName: string | null;
  referrerUser: { id: string; name: string } | null;
  certificateUrl: string | null;
  certificateFileName: string | null;
  createdAt: string;
  confirmationEmailSentAt: string | null;
  reminderEmailSentAt: string | null;
  user: { id: string } | null;
  studentLink: StudentLink;
};

type CheckinPayload = {
  event: {
    id: string;
    name: string | null;
    subtitle: string | null;
    slug: string | null;
    recurring: boolean;
    eventStartTime: string | null;
    eventEndTime: string | null;
    allowsRegistration: boolean;
    allowsReferral: boolean;
    capacity: number | null;
    isActive: boolean;
    responsibleTeacherName: string | null;
  };
  occurrenceDate: string;
  occurrences: string[];
  today: string;
  registrations: CheckinRegistration[];
  raffles: RaffleItem[];
  stats: { registered: number; present: number; ticketsIssued: number };
};

type SortMode = "alpha" | "newest";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDateLong(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatHm(value: string | null): string {
  return value?.trim().slice(0, 5) ?? "";
}

function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

async function parseApiJson<T>(res: Response): Promise<ApiResponse<T> | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return null;
  }
}

function sortRegistrations(list: CheckinRegistration[], mode: SortMode): CheckinRegistration[] {
  const copy = [...list];
  if (mode === "newest") {
    copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name, "pt-BR"));
  } else {
    copy.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }
  return copy;
}

function matchesQuery(r: CheckinRegistration, term: string, digits: string): boolean {
  if (!term && digits.length < 3) return true;
  if (term && normalize(r.name).includes(term)) return true;
  if (term && r.checkinCode && normalize(r.checkinCode).includes(term)) return true;
  if (term && r.email && normalize(r.email).includes(term)) return true;
  if (digits.length >= 3) {
    if (r.phone?.replace(/\D/g, "").includes(digits)) return true;
    if (r.cpf?.replace(/\D/g, "").includes(digits)) return true;
    if (String(r.raffleNumber ?? "") === digits) return true;
    if (r.checkinCode?.replace(/\D/g, "").includes(digits)) return true;
  }
  return Boolean(term) ? false : digits.length < 3;
}

export function HolidayEventCheckinClient({
  holidayId,
  initialDate,
}: {
  holidayId: string;
  initialDate: string | null;
}) {
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CheckinPayload | null>(null);
  const [occurrenceDate, setOccurrenceDate] = useState<string | null>(initialDate);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lastIssued, setLastIssued] = useState<{ name: string; number: number } | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("alpha");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [presentOpen, setPresentOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState<"guest" | "user">("guest");
  const [userEmail, setUserEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestCpf, setGuestCpf] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);

  const load = useCallback(
    async (date?: string | null, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const qs = date ? `?data=${date}` : "";
        const res = await fetch(`/api/holidays/${holidayId}/checkin${qs}`);
        const json = await parseApiJson<CheckinPayload>(res);
        if (!res.ok || !json || !json.ok) {
          toast.push("error", json && !json.ok ? json.error.message : "Não foi possível carregar o evento.");
          if (!opts?.silent) setData(null);
          return;
        }
        setData(json.data);
        setOccurrenceDate(json.data.occurrenceDate);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [holidayId, toast],
  );

  useEffect(() => {
    void load(initialDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualização silenciosa a cada 45s para acompanhar cadastros feitos em outra tela.
  useEffect(() => {
    if (!occurrenceDate) return;
    const t = window.setInterval(() => {
      if (savingId || savingAdd || document.hidden) return;
      void load(occurrenceDate, { silent: true });
    }, 45_000);
    return () => window.clearInterval(t);
  }, [occurrenceDate, load, savingId, savingAdd]);

  const term = normalize(query.trim());
  const digits = query.replace(/\D/g, "");

  const pendingList = useMemo(() => {
    const list = (data?.registrations ?? []).filter((r) => r.present !== true);
    const filtered = list.filter((r) => matchesQuery(r, term, digits));
    return sortRegistrations(filtered, sortMode);
  }, [data?.registrations, term, digits, sortMode]);

  const presentList = useMemo(() => {
    const list = (data?.registrations ?? []).filter((r) => r.present === true);
    const filtered = list.filter((r) => matchesQuery(r, term, digits));
    return sortRegistrations(filtered, sortMode);
  }, [data?.registrations, term, digits, sortMode]);

  const summaryItems: EventSummaryRegistration[] = useMemo(
    () =>
      (data?.registrations ?? []).map((r) => ({
        id: r.id,
        present: r.present,
        confirmationEmailSentAt: r.confirmationEmailSentAt,
        reminderEmailSentAt: r.reminderEmailSentAt,
        user: r.user,
        referrerUser: r.referrerUser,
        studentLink: r.studentLink,
      })),
    [data?.registrations],
  );

  function focusSearch() {
    window.setTimeout(() => searchRef.current?.focus(), 50);
  }

  async function toggleAttendance(reg: CheckinRegistration) {
    if (savingId) return;
    const nextPresent = reg.present !== true;
    setSavingId(reg.id);
    try {
      const res = await fetch(`/api/holidays/registrations/${reg.id}/attendance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ present: nextPresent, notifyParticipant: nextPresent }),
      });
      const json = await parseApiJson<{ raffleNumber: number | null; participantName: string }>(res);
      if (!res.ok || !json || !json.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Não foi possível salvar a presença.");
        return;
      }

      const raffleNumber = json.data.raffleNumber;
      setData((prev) =>
        prev
          ? {
              ...prev,
              registrations: prev.registrations.map((r) =>
                r.id === reg.id
                  ? {
                      ...r,
                      present: nextPresent,
                      attendanceMarkedAt: new Date().toISOString(),
                      raffleNumber: nextPresent ? raffleNumber : null,
                    }
                  : r,
              ),
            }
          : prev,
      );

      if (nextPresent) {
        setQuery("");
        if (raffleNumber != null) {
          setLastIssued({ name: reg.name, number: raffleNumber });
          toast.push("success", `${reg.name} · Nº ${raffleNumber}`);
        } else {
          setLastIssued(null);
          toast.push("success", `${reg.name} confirmado(a).`);
        }
        focusSearch();
      } else {
        setLastIssued(null);
        toast.push("success", `Presença de ${reg.name} desfeita.`);
      }
    } finally {
      setSavingId(null);
    }
  }

  async function confirmFirstMatch() {
    if (pendingList.length === 0 || savingId) return;
    await toggleAttendance(pendingList[0]);
  }

  async function submitAdd() {
    if (!data || savingAdd) return;
    setSavingAdd(true);
    try {
      const body =
        addMode === "user"
          ? { holidayId, occurrenceDate: data.occurrenceDate, userEmail }
          : {
              holidayId,
              occurrenceDate: data.occurrenceDate,
              name: guestName,
              phone: guestPhone,
              email: guestEmail || undefined,
              cpf: guestCpf || undefined,
            };
      const res = await fetch("/api/holidays/registrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await parseApiJson<{
        alreadyRegistered?: boolean;
        participantName?: string;
      }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Falha ao cadastrar inscrição.");
        return;
      }
      const who = json.data.participantName?.trim();
      toast.push(
        "success",
        json.data.alreadyRegistered
          ? who
            ? `${who} já estava inscrito(a).`
            : "Participante já estava inscrito."
          : who
            ? `${who} inscrito(a).`
            : "Inscrição cadastrada.",
      );
      setAdding(false);
      setUserEmail("");
      setGuestName("");
      setGuestPhone("");
      setGuestEmail("");
      setGuestCpf("");
      await load(data.occurrenceDate, { silent: true });
      focusSearch();
    } finally {
      setSavingAdd(false);
    }
  }

  const eventName = data?.event.name?.trim() || `Evento ${BRAND.shortName}`;
  const presentCount = data?.registrations.filter((r) => r.present === true).length ?? 0;
  const registeredCount = data?.registrations.length ?? 0;
  const pendingCount = registeredCount - presentCount;
  const ticketsCount = data?.registrations.filter((r) => r.raffleNumber != null).length ?? 0;

  return (
    <div className="min-w-0 space-y-5">
      <DashboardHero
        eyebrow="Eventos"
        title="Check-in de presença"
        description={
          data
            ? `${eventName} · ${formatDateLong(data.occurrenceDate)} · ${formatHm(
                data.event.eventStartTime,
              )}–${formatHm(data.event.eventEndTime)}`
            : "Carregando dados do evento…"
        }
        rightSlot={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {data && data.occurrences.length > 1 ? (
              <select
                className="theme-input h-11 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)] sm:w-auto"
                value={occurrenceDate ?? data.occurrenceDate}
                onChange={(e) => void load(e.target.value)}
              >
                {data.occurrences.map((d) => (
                  <option key={d} value={d}>
                    {d === data.today ? `${d} (hoje)` : d}
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => void load(occurrenceDate)}
              disabled={loading}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
              Atualizar
            </Button>
            <Button type="button" variant="secondary" onClick={() => window.location.assign("/holidays")}>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
              Voltar
            </Button>
          </div>
        }
      />

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-20" role="status">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--igh-primary)]/20" aria-hidden />
          <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando…</p>
        </div>
      ) : !data ? (
        <SectionCard title="Evento indisponível">
          <p className="text-sm text-[var(--text-muted)]">
            Não foi possível carregar este evento. Verifique se ele existe e aceita inscrições.
          </p>
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <Users className="h-4 w-4" aria-hidden />
                Inscritos
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{registeredCount}</p>
              {data.event.capacity ? (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Limite de {data.event.capacity} vagas</p>
              ) : (
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Sem limite de vagas</p>
              )}
            </div>
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:bg-emerald-900/15">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Presentes
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{presentCount}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {pendingCount} aguardando ·{" "}
                {registeredCount > 0 ? `${Math.round((presentCount / registeredCount) * 100)}%` : "0%"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <Ticket className="h-4 w-4" aria-hidden />
                Números emitidos
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--igh-primary)]">{ticketsCount}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {data.raffles.length === 0
                  ? "Nenhum sorteio cadastrado"
                  : data.raffles.length === 1
                    ? "1 sorteio nesta data"
                    : `${data.raffles.length} sorteios nesta data`}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            <button
              type="button"
              onClick={() => setSummaryOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--igh-surface)]/50"
              aria-expanded={summaryOpen}
            >
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Resumo do evento</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Alunos, cursos, indicações e presença — toque para {summaryOpen ? "ocultar" : "ver"}
                </p>
              </div>
              {summaryOpen ? (
                <ChevronDown className="h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden />
              )}
            </button>
            {summaryOpen ? (
              <div className="border-t border-[var(--card-border)] px-3 pb-3 sm:px-4 sm:pb-4">
                <HolidayEventSummaryDashboard items={summaryItems} capacity={data.event.capacity} />
              </div>
            ) : null}
          </div>

          {lastIssued ? (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-center dark:bg-emerald-900/20">
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                Presença confirmada: {lastIssued.name}
              </p>
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                Informe este número ao participante
              </p>
              <p className="mt-2 text-5xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-300">
                {lastIssued.number}
              </p>
              <Button type="button" variant="secondary" className="mt-3" onClick={() => setLastIssued(null)}>
                Fechar
              </Button>
            </div>
          ) : null}

          {/* Busca sticky para operação rápida */}
          <div className="sticky top-0 z-20 -mx-1 space-y-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/95 p-3 shadow-sm backdrop-blur sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                  aria-hidden
                />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void confirmFirstMatch();
                    }
                    if (e.key === "Escape") setQuery("");
                  }}
                  placeholder="Buscar nome, código, telefone… (Enter confirma o 1º)"
                  className="h-12 pl-9 text-base"
                  autoFocus
                />
                {query ? (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    onClick={() => {
                      setQuery("");
                      focusSearch();
                    }}
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <Button
                type="button"
                className="h-12 shrink-0"
                onClick={() => {
                  setAdding((v) => !v);
                  setAddMode("guest");
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                {adding ? "Fechar cadastro" : "Adicionar inscrito"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Ordenar:</span>
              <button
                type="button"
                onClick={() => setSortMode("alpha")}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  sortMode === "alpha"
                    ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                    : "border-[var(--card-border)] bg-white text-[var(--text-secondary)]"
                }`}
              >
                A–Z
              </button>
              <button
                type="button"
                onClick={() => setSortMode("newest")}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  sortMode === "newest"
                    ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                    : "border-[var(--card-border)] bg-white text-[var(--text-secondary)]"
                }`}
              >
                Cadastro (mais recentes)
              </button>
              <span className="ml-auto text-xs text-[var(--text-muted)]">
                {pendingCount} na fila · {presentCount} presentes
              </span>
            </div>

            {adding ? (
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--igh-surface)]/40 p-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAddMode("guest")}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      addMode === "guest"
                        ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                        : "border-[var(--card-border)] bg-white"
                    }`}
                  >
                    Sem conta
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode("user")}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      addMode === "user"
                        ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                        : "border-[var(--card-border)] bg-white"
                    }`}
                  >
                    Usuário existente (e-mail)
                  </button>
                </div>
                {addMode === "user" ? (
                  <div>
                    <label className="text-xs font-medium">E-mail do usuário</label>
                    <div className="mt-1">
                      <Input
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        type="email"
                        placeholder="usuario@email.com"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium">Nome *</label>
                      <div className="mt-1">
                        <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Telefone *</label>
                      <div className="mt-1">
                        <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium">E-mail (opcional)</label>
                      <div className="mt-1">
                        <Input
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          type="email"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium">CPF (opcional)</label>
                      <div className="mt-1">
                        <Input value={guestCpf} onChange={(e) => setGuestCpf(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" disabled={savingAdd} onClick={() => void submitAdd()}>
                    {savingAdd ? "Salvando…" : "Salvar inscrição"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <SectionCard
            title={`Aguardando (${pendingList.length})`}
            description="Participantes ainda não checados. Enter na busca confirma o primeiro da lista."
            variant="elevated"
          >
            {pendingList.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                {registeredCount === 0
                  ? "Nenhum inscrito nesta data. Use “Adicionar inscrito”."
                  : query
                    ? "Ninguém aguardando com esse filtro."
                    : "Todos os inscritos já foram confirmados."}
              </p>
            ) : (
              <ul className="list-none space-y-2 pl-0">
                {pendingList.map((reg, idx) => (
                  <li
                    key={reg.id}
                    className={`rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 sm:p-4 ${
                      idx === 0 && query.trim() ? "ring-2 ring-[var(--igh-primary)]/40" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-[var(--text-primary)]">
                          <span className="truncate">{reg.name}</span>
                          {reg.studentLink ? <Badge tone="green">Aluno</Badge> : null}
                          {reg.isGuest && !reg.studentLink ? <Badge tone="zinc">Convidado</Badge> : null}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                          {[
                            reg.checkinCode ? `Código ${reg.checkinCode}` : null,
                            formatPhoneDisplay(reg.phone) || null,
                            reg.email,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Sem contato informado"}
                        </p>
                        {reg.referrerName ? (
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            Indicado por {reg.referrerName}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        disabled={savingId === reg.id}
                        className="min-h-[52px] w-full shrink-0 text-base sm:min-w-[200px] sm:w-auto"
                        onClick={() => void toggleAttendance(reg)}
                      >
                        <Circle className="mr-1.5 h-5 w-5" aria-hidden />
                        {savingId === reg.id ? "Salvando…" : "Confirmar presença"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <div className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-[var(--card-bg)]">
            <button
              type="button"
              onClick={() => setPresentOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10"
              aria-expanded={presentOpen}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Presentes ({presentList.length})
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Já checaram — use “Desfazer” se precisar corrigir
                  </p>
                </div>
              </div>
              {presentOpen ? (
                <ChevronDown className="h-5 w-5 text-[var(--text-muted)]" aria-hidden />
              ) : (
                <ChevronRight className="h-5 w-5 text-[var(--text-muted)]" aria-hidden />
              )}
            </button>
            {presentOpen ? (
              <div className="border-t border-emerald-200/60 px-3 pb-3 sm:px-4 sm:pb-4">
                {presentList.length === 0 ? (
                  <p className="pt-3 text-sm text-[var(--text-muted)]">
                    {query ? "Nenhum presente com esse filtro." : "Ninguém confirmado ainda."}
                  </p>
                ) : (
                  <ul className="mt-3 list-none space-y-2 pl-0">
                    {presentList.map((reg) => (
                      <li
                        key={reg.id}
                        className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:bg-emerald-900/10 sm:p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 font-semibold text-[var(--text-primary)]">
                              <span className="truncate">{reg.name}</span>
                              {reg.raffleNumber != null ? (
                                <Badge tone="amber">Nº {reg.raffleNumber}</Badge>
                              ) : null}
                              {reg.studentLink ? <Badge tone="green">Aluno</Badge> : null}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                              {[
                                reg.checkinCode ? `Código ${reg.checkinCode}` : null,
                                formatPhoneDisplay(reg.phone) || null,
                                reg.email,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {reg.certificateUrl ? (
                              <p className="mt-1 text-xs text-[var(--text-muted)]">
                                Certificado:{" "}
                                <a
                                  className="text-[var(--igh-primary)] underline hover:no-underline"
                                  href={reg.certificateUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {reg.certificateFileName ?? "baixar"}
                                </a>
                              </p>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={savingId === reg.id}
                            className="min-h-[44px] w-full shrink-0 sm:w-auto"
                            onClick={() => void toggleAttendance(reg)}
                          >
                            <Undo2 className="mr-1.5 h-4 w-4" aria-hidden />
                            Desfazer
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <SectionCard
            title="Sorteios"
            description={
              data.raffles.length === 0
                ? "Cadastre os sorteios no formulário do evento em /holidays."
                : "O sistema escolhe aleatoriamente entre os números de quem teve presença confirmada."
            }
            variant="elevated"
            action={
              data.raffles.length === 0 ? null : (
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Gift className="h-4 w-4" aria-hidden />
                  {presentCount} elegíveis
                </span>
              )
            }
          >
            <RaffleDrawPanel
              holidayId={holidayId}
              occurrenceDate={data.occurrenceDate}
              eventName={eventName}
              raffles={data.raffles}
              eligibleCount={presentCount}
              onChanged={() => void load(occurrenceDate, { silent: true })}
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}
