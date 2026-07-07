"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Mail, Search, Users } from "lucide-react";

import { SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type RegistrationRow = {
  id: string;
  holidayId: string;
  occurrenceDate: string;
  createdAt: string;
  confirmationEmailSentAt: string | null;
  reminderEmailSentAt: string | null;
  user: { id: string; name: string; email: string };
  holiday: {
    id: string;
    name: string | null;
    subtitle: string | null;
    recurring: boolean;
    eventStartTime: string | null;
    eventEndTime: string | null;
    allowsRegistration: boolean;
    isActive: boolean;
  };
};

type Scope = "upcoming" | "past" | "all";

function formatHm(value: string | null): string {
  if (!value) return "";
  const s = value.trim();
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function formatOccurrenceHeading(ymd: string): string {
  return new Date(ymd + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupKey(holidayId: string, occurrenceDate: string) {
  return `${holidayId}:${occurrenceDate}`;
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

export function HolidayEventRegistrationsPanel({
  focusHolidayId = null,
  onClearFocus,
}: {
  focusHolidayId?: string | null;
  onClearFocus?: () => void;
}) {
  const [scope, setScope] = useState<Scope>("upcoming");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope });
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (focusHolidayId) params.set("holidayId", focusHolidayId);
      const res = await fetch(`/api/holidays/registrations?${params.toString()}`);
      const json = await parseApiJson<{ registrations: RegistrationRow[] }>(res);
      if (res.ok && json?.ok) {
        setRows(json.data.registrations);
      } else {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [scope, debouncedQuery, focusHolidayId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focusHolidayId) {
      setScope("all");
    }
  }, [focusHolidayId]);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        holidayId: string;
        occurrenceDate: string;
        holiday: RegistrationRow["holiday"];
        items: RegistrationRow[];
      }
    >();
    for (const row of rows) {
      const key = groupKey(row.holidayId, row.occurrenceDate);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(row);
      } else {
        map.set(key, {
          key,
          holidayId: row.holidayId,
          occurrenceDate: row.occurrenceDate,
          holiday: row.holiday,
          items: [row],
        });
      }
    }
    return [...map.values()].sort((a, b) => {
      const dateCmp =
        scope === "past"
          ? b.occurrenceDate.localeCompare(a.occurrenceDate)
          : a.occurrenceDate.localeCompare(b.occurrenceDate);
      if (dateCmp !== 0) return dateCmp;
      return (a.holiday.name ?? "").localeCompare(b.holiday.name ?? "", "pt-BR");
    });
  }, [rows, scope]);

  const totalRegistrations = rows.length;

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <SectionCard
      title="Inscrições em eventos"
      description={
        loading
          ? "Carregando inscrições…"
          : `${totalRegistrations} inscrição${totalRegistrations === 1 ? "" : "ões"} em ${groups.length} ocorrência${groups.length === 1 ? "" : "s"}.`
      }
      variant="elevated"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["upcoming", "Próximos"],
                ["past", "Passados"],
                ["all", "Todos"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  scope === value
                    ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                    : "border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:border-[var(--igh-primary)]/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar evento, nome ou e-mail…"
              className="pl-9"
            />
          </div>
        </div>

        {focusHolidayId ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--igh-primary)]/25 bg-[var(--igh-primary)]/5 px-3 py-2 text-sm">
            <span className="text-[var(--text-secondary)]">Filtro ativo por evento selecionado na listagem.</span>
            {onClearFocus ? (
              <Button type="button" variant="secondary" size="sm" onClick={onClearFocus}>
                Ver todas
              </Button>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12" role="status">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--igh-primary)]/20" aria-hidden />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando inscrições…</p>
          </div>
        ) : groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--card-border)] py-12 text-center text-sm text-[var(--text-muted)]">
            Nenhuma inscrição encontrada para os filtros selecionados.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map((group) => {
              const isOpen = expanded.has(group.key);
              const eventName = group.holiday.name?.trim() || "Evento sem nome";
              return (
                <li
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-[var(--card-border)] bg-white"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-[var(--igh-surface)]/60"
                    aria-expanded={isOpen}
                  >
                    <span className="mt-0.5 text-[var(--text-muted)]">
                      {isOpen ? (
                        <ChevronDown className="h-5 w-5" aria-hidden />
                      ) : (
                        <ChevronRight className="h-5 w-5" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--text-primary)]">{eventName}</p>
                        {!group.holiday.isActive ? (
                          <Badge tone="red">Evento inativo</Badge>
                        ) : null}
                        <Badge tone="green">
                          <Users className="mr-1 inline h-3.5 w-3.5" />
                          {group.items.length} inscrito{group.items.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      {group.holiday.subtitle ? (
                        <p className="mt-1 text-sm text-[var(--text-muted)]">{group.holiday.subtitle}</p>
                      ) : null}
                      <p className="mt-2 text-sm capitalize text-[var(--text-secondary)]">
                        {formatOccurrenceHeading(group.occurrenceDate)}
                      </p>
                      {group.holiday.eventStartTime && group.holiday.eventEndTime ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <Clock className="h-3.5 w-3.5" />
                          {formatHm(group.holiday.eventStartTime)} – {formatHm(group.holiday.eventEndTime)}
                        </p>
                      ) : null}
                    </div>
                  </button>
                  {isOpen ? (
                    <div className="border-t border-[var(--card-border)] px-4 pb-4">
                      <TableShell className="mt-3">
                        <thead>
                          <tr>
                            <Th>Participante</Th>
                            <Th>E-mail</Th>
                            <Th>Inscrito em</Th>
                            <Th>E-mails</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((row) => (
                            <tr key={row.id}>
                              <Td className="font-medium">{row.user.name}</Td>
                              <Td className="text-[var(--text-secondary)]">{row.user.email}</Td>
                              <Td className="text-[var(--text-secondary)]">{formatDateTime(row.createdAt)}</Td>
                              <Td className="text-xs text-[var(--text-secondary)]">
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex items-center gap-1">
                                    <Mail className="h-3.5 w-3.5" />
                                    Confirmação: {row.confirmationEmailSentAt ? "enviado" : "pendente"}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <Mail className="h-3.5 w-3.5" />
                                    Lembrete: {row.reminderEmailSentAt ? "enviado" : "pendente"}
                                  </span>
                                </div>
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </TableShell>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
