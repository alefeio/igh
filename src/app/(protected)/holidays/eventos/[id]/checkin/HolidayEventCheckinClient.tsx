"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Gift,
  RefreshCw,
  Search,
  Ticket,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { RaffleDrawPanel, type RaffleItem } from "@/components/holidays/RaffleDrawPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import { BRAND } from "@/lib/brand";

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
  certificateUrl: string | null;
  certificateFileName: string | null;
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

async function parseApiJson<T>(res: Response): Promise<ApiResponse<T> | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return null;
  }
}

export function HolidayEventCheckinClient({
  holidayId,
  initialDate,
}: {
  holidayId: string;
  initialDate: string | null;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CheckinPayload | null>(null);
  const [occurrenceDate, setOccurrenceDate] = useState<string | null>(initialDate);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lastIssued, setLastIssued] = useState<{ name: string; number: number } | null>(null);
  const [onlyPending, setOnlyPending] = useState(false);

  const load = useCallback(
    async (date?: string | null) => {
      setLoading(true);
      try {
        const qs = date ? `?data=${date}` : "";
        const res = await fetch(`/api/holidays/${holidayId}/checkin${qs}`);
        const json = await parseApiJson<CheckinPayload>(res);
        if (!res.ok || !json || !json.ok) {
          toast.push("error", json && !json.ok ? json.error.message : "Não foi possível carregar o evento.");
          setData(null);
          return;
        }
        setData(json.data);
        setOccurrenceDate(json.data.occurrenceDate);
      } finally {
        setLoading(false);
      }
    },
    [holidayId, toast],
  );

  useEffect(() => {
    void load(initialDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const list = data?.registrations ?? [];
    const term = normalize(query.trim());
    const digits = query.replace(/\D/g, "");
    const base = onlyPending ? list.filter((r) => r.present !== true) : list;
    if (!term) return base;
    return base.filter((r) => {
      if (normalize(r.name).includes(term)) return true;
      if (r.checkinCode && normalize(r.checkinCode).includes(term)) return true;
      if (r.email && normalize(r.email).includes(term)) return true;
      if (digits.length >= 3) {
        if (r.phone?.replace(/\D/g, "").includes(digits)) return true;
        if (r.cpf?.replace(/\D/g, "").includes(digits)) return true;
        if (String(r.raffleNumber ?? "") === digits) return true;
      }
      return false;
    });
  }, [data?.registrations, onlyPending, query]);

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

      if (nextPresent && raffleNumber != null) {
        setLastIssued({ name: reg.name, number: raffleNumber });
        toast.push("success", `Presença confirmada. Número do sorteio: ${raffleNumber}.`);
      } else if (nextPresent) {
        toast.push("success", "Presença confirmada.");
      } else {
        setLastIssued(null);
        toast.push("success", "Presença desfeita.");
      }
    } finally {
      setSavingId(null);
    }
  }

  const eventName = data?.event.name?.trim() || `Evento ${BRAND.shortName}`;
  const presentCount = data?.registrations.filter((r) => r.present === true).length ?? 0;
  const registeredCount = data?.registrations.length ?? 0;

  return (
    <div className="min-w-0 space-y-6">
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
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Limite de {data.event.capacity} vagas
                </p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Presentes
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{presentCount}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {registeredCount - presentCount} ainda não chegaram
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                <Ticket className="h-4 w-4" aria-hidden />
                Números emitidos
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--igh-primary)]">
                {data.registrations.filter((r) => r.raffleNumber != null).length}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {data.raffles.length === 0
                  ? "Nenhum sorteio cadastrado"
                  : data.raffles.length === 1
                    ? "1 sorteio nesta data"
                    : `${data.raffles.length} sorteios nesta data`}
              </p>
            </div>
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
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => setLastIssued(null)}
              >
                Fechar
              </Button>
            </div>
          ) : null}

          <SectionCard
            title="Participantes"
            description="Busque por nome, código de check-in, telefone, CPF, e-mail ou número emitido."
            variant="elevated"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nome, código, telefone…"
                  className="pl-9"
                  autoFocus
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={onlyPending}
                  onChange={(e) => setOnlyPending(e.target.checked)}
                />
                Só quem falta confirmar
              </label>
            </div>

            {filtered.length === 0 ? (
              <p className="mt-6 text-sm text-[var(--text-muted)]">
                {registeredCount === 0
                  ? "Nenhum inscrito nesta data."
                  : "Nenhum participante encontrado com esse filtro."}
              </p>
            ) : (
              <ul className="mt-4 list-none space-y-3 pl-0">
                {filtered.map((reg) => {
                  const present = reg.present === true;
                  return (
                    <li
                      key={reg.id}
                      className={`rounded-xl border p-4 ${
                        present
                          ? "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/10"
                          : "border-[var(--card-border)] bg-[var(--card-bg)]"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-semibold text-[var(--text-primary)]">
                            <span className="truncate">{reg.name}</span>
                            {reg.isGuest ? <Badge tone="zinc">Convidado</Badge> : null}
                            {reg.raffleNumber != null ? (
                              <Badge tone="amber">Nº {reg.raffleNumber}</Badge>
                            ) : null}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                            {[reg.checkinCode ? `Código ${reg.checkinCode}` : null, reg.phone, reg.email]
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
                          variant={present ? "secondary" : "primary"}
                          disabled={savingId === reg.id}
                          className="min-h-[48px] w-full shrink-0 sm:w-auto"
                          onClick={() => void toggleAttendance(reg)}
                        >
                          {present ? (
                            <>
                              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />
                              Presente — desfazer
                            </>
                          ) : (
                            <>
                              <Circle className="mr-1.5 h-4 w-4" aria-hidden />
                              Confirmar presença
                            </>
                          )}
                        </Button>
                      </div>
                      {present && reg.certificateUrl ? (
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
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
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

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
              onChanged={() => void load(occurrenceDate)}
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}
