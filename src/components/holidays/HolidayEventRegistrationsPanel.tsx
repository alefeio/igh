"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Mail,
  Plus,
  Printer,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

import { SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
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
  guestName: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  guestCpf: string | null;
  present: boolean | null;
  checkinCode: string | null;
  user: { id: string; name: string; email: string; whatsapp: string | null } | null;
  referrerUser: { id: string; name: string } | null;
  raffleTicket: { number: number } | null;
  holiday: {
    id: string;
    name: string | null;
    subtitle: string | null;
    slug: string | null;
    recurring: boolean;
    eventStartTime: string | null;
    eventEndTime: string | null;
    allowsRegistration: boolean;
    allowsReferral: boolean;
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

function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

function participantName(row: RegistrationRow): string {
  return row.user?.name ?? row.guestName ?? "—";
}

function participantEmail(row: RegistrationRow): string {
  return row.user?.email ?? row.guestEmail ?? "—";
}

function participantPhone(row: RegistrationRow): string {
  return formatPhoneDisplay(row.user?.whatsapp ?? row.guestPhone);
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
  const toast = useToast();
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [emptyEvent, setEmptyEvent] = useState<{
    id: string;
    occurrenceDate: string;
    holiday: RegistrationRow["holiday"];
  } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [mode, setMode] = useState<"user" | "guest">("guest");
  const [userEmail, setUserEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestCpf, setGuestCpf] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

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
      const json = await parseApiJson<{
        registrations: RegistrationRow[];
        emptyEvent: {
          id: string;
          name: string | null;
          subtitle: string | null;
          slug: string | null;
          recurring: boolean;
          eventStartTime: string | null;
          eventEndTime: string | null;
          allowsRegistration: boolean;
          allowsReferral: boolean;
          isActive: boolean;
          occurrenceDate: string;
        } | null;
      }>(res);
      if (res.ok && json?.ok) {
        setRows(json.data.registrations);
        const empty = json.data.emptyEvent;
        setEmptyEvent(
          empty
            ? {
                id: empty.id,
                occurrenceDate: empty.occurrenceDate,
                holiday: {
                  id: empty.id,
                  name: empty.name,
                  subtitle: empty.subtitle,
                  slug: empty.slug,
                  recurring: empty.recurring,
                  eventStartTime: empty.eventStartTime,
                  eventEndTime: empty.eventEndTime,
                  allowsRegistration: empty.allowsRegistration,
                  allowsReferral: empty.allowsReferral,
                  isActive: empty.isActive,
                },
              }
            : null,
        );
      } else {
        setRows([]);
        setEmptyEvent(null);
      }
    } finally {
      setLoading(false);
    }
  }, [scope, debouncedQuery, focusHolidayId]);

  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => setHighlightId(null), 6000);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focusHolidayId) {
      setScope("all");
      setQuery("");
      setDebouncedQuery("");
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
    if (emptyEvent && focusHolidayId === emptyEvent.id && rows.length === 0) {
      const key = groupKey(emptyEvent.id, emptyEvent.occurrenceDate);
      if (!map.has(key)) {
        map.set(key, {
          key,
          holidayId: emptyEvent.id,
          occurrenceDate: emptyEvent.occurrenceDate,
          holiday: emptyEvent.holiday,
          items: [],
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
  }, [rows, scope, emptyEvent, focusHolidayId]);

  const totalRegistrations = rows.length;

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openAddForm(key: string) {
    setAddingFor(key);
    setMode("guest");
    setUserEmail("");
    setGuestName("");
    setGuestPhone("");
    setGuestEmail("");
    setGuestCpf("");
    setExpanded((prev) => new Set(prev).add(key));
  }

  async function submitAdd(holidayId: string, occurrenceDate: string) {
    if (saving) return;
    setSaving(true);
    try {
      const body =
        mode === "user"
          ? { holidayId, occurrenceDate, userEmail }
          : {
              holidayId,
              occurrenceDate,
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
        registration?: { id: string };
      }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Falha ao cadastrar inscrição.");
        return;
      }

      const already = Boolean(json.data.alreadyRegistered);
      const who = json.data.participantName?.trim();
      toast.push(
        "success",
        already
          ? who
            ? `${who} já estava inscrito(a). A busca foi limpa para exibir na lista.`
            : "Participante já estava inscrito. A busca foi limpa para exibir na lista."
          : "Inscrição cadastrada.",
      );

      // Força listagem completa: a pessoa podia existir no banco e estar oculta pelo filtro/busca.
      setQuery("");
      setDebouncedQuery("");
      setScope("all");
      setAddingFor(null);
      const key = groupKey(holidayId, occurrenceDate);
      setExpanded((prev) => new Set(prev).add(key));
      if (json.data.registration?.id) setHighlightId(json.data.registration.id);

      setLoading(true);
      try {
        const params = new URLSearchParams({ scope: "all" });
        if (focusHolidayId) params.set("holidayId", focusHolidayId);
        const reloadRes = await fetch(`/api/holidays/registrations?${params.toString()}`);
        const reloadJson = await parseApiJson<{
          registrations: RegistrationRow[];
          emptyEvent: {
            id: string;
            name: string | null;
            subtitle: string | null;
            slug: string | null;
            recurring: boolean;
            eventStartTime: string | null;
            eventEndTime: string | null;
            allowsRegistration: boolean;
            allowsReferral: boolean;
            isActive: boolean;
            occurrenceDate: string;
          } | null;
        }>(reloadRes);
        if (reloadRes.ok && reloadJson?.ok) {
          setRows(reloadJson.data.registrations);
          const empty = reloadJson.data.emptyEvent;
          setEmptyEvent(
            empty
              ? {
                  id: empty.id,
                  occurrenceDate: empty.occurrenceDate,
                  holiday: {
                    id: empty.id,
                    name: empty.name,
                    subtitle: empty.subtitle,
                    slug: empty.slug,
                    recurring: empty.recurring,
                    eventStartTime: empty.eventStartTime,
                    eventEndTime: empty.eventEndTime,
                    allowsRegistration: empty.allowsRegistration,
                    allowsReferral: empty.allowsReferral,
                    isActive: empty.isActive,
                  },
                }
              : null,
          );
        }
      } finally {
        setLoading(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeRegistration(id: string) {
    if (deletingId) return;
    if (!confirm("Excluir esta inscrição do evento?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/holidays/registrations/${id}`, { method: "DELETE" });
      const json = await parseApiJson<{ deleted: boolean }>(res);
      if (!res.ok || !json?.ok) {
        toast.push("error", json && !json.ok ? json.error.message : "Falha ao excluir.");
        return;
      }
      toast.push("success", "Inscrição excluída.");
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  async function exportGroupXlsx(group: { key: string; holidayId: string; occurrenceDate: string }) {
    if (exportingKey) return;
    setExportingKey(group.key);
    try {
      const res = await fetch(
        `/api/holidays/${group.holidayId}/registrations/export?occurrenceDate=${group.occurrenceDate}`,
      );
      if (!res.ok) {
        toast.push("error", "Não foi possível gerar a planilha.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evento-${group.occurrenceDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingKey(null);
    }
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildAttendanceListHtml(
    list: Array<{
      key: string;
      holiday: RegistrationRow["holiday"];
      occurrenceDate: string;
      items: RegistrationRow[];
    }>,
  ) {
    const sections = list
      .map((group, index) => {
        const eventName = group.holiday.name?.trim() || "Evento sem nome";
        const subtitle = group.holiday.subtitle?.trim() || "";
        const dateLabel = formatOccurrenceHeading(group.occurrenceDate);
        const timeLabel =
          group.holiday.eventStartTime && group.holiday.eventEndTime
            ? `${formatHm(group.holiday.eventStartTime)} – ${formatHm(group.holiday.eventEndTime)}`
            : "";
        const names = [...group.items]
          .map((row) => participantName(row))
          .sort((a, b) => a.localeCompare(b, "pt-BR"));
        const rowsHtml = names
          .map(
            (name, i) => `
              <tr>
                <td class="num">${i + 1}</td>
                <td class="name">${escapeHtml(name)}</td>
                <td class="sign"></td>
              </tr>`,
          )
          .join("");
        const pageBreak = index < list.length - 1 ? " page-break" : "";
        return `
          <section class="event${pageBreak}">
            <h1>${escapeHtml(eventName)}</h1>
            ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
            <p class="meta">${escapeHtml(dateLabel)}${timeLabel ? ` · ${escapeHtml(timeLabel)}` : ""}</p>
            <p class="count">${names.length} inscrito${names.length === 1 ? "" : "s"}</p>
            <table>
              <thead>
                <tr>
                  <th class="num">#</th>
                  <th class="name">Nome</th>
                  <th class="sign">Assinatura</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || `<tr><td colspan="3" class="empty">Nenhum inscrito.</td></tr>`}
              </tbody>
            </table>
          </section>`;
      })
      .join("");

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Lista de presença — eventos</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
              color: #171717;
              margin: 0;
              padding: 24px;
            }
            .event { padding-bottom: 8px; }
            .page-break { page-break-after: always; break-after: page; }
            h1 {
              font-size: 1.35rem;
              margin: 0 0 4px;
              line-height: 1.3;
            }
            .subtitle {
              margin: 0 0 6px;
              font-size: 0.95rem;
              color: #3f3f46;
            }
            .meta {
              margin: 0;
              font-size: 0.9rem;
              color: #52525b;
              text-transform: capitalize;
            }
            .count {
              margin: 8px 0 14px;
              font-size: 0.8rem;
              color: #71717a;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.9rem;
            }
            th, td {
              border: 1px solid #d4d4d8;
              padding: 10px 12px;
              vertical-align: middle;
            }
            th {
              background: #f4f4f5;
              font-weight: 600;
              text-align: left;
            }
            .num { width: 40px; text-align: center; }
            th.num { text-align: center; }
            .name { width: 42%; }
            .sign { min-height: 36px; height: 42px; }
            .empty { text-align: center; color: #71717a; }
            @media print {
              body { padding: 12mm; }
              .page-break { page-break-after: always; break-after: page; }
            }
          </style>
        </head>
        <body>
          ${sections}
          <script>
            setTimeout(function () { window.print(); }, 250);
          </script>
        </body>
      </html>`;
  }

  function printAttendanceLists(
    list: Array<{
      key: string;
      holiday: RegistrationRow["holiday"];
      occurrenceDate: string;
      items: RegistrationRow[];
    }>,
  ) {
    if (list.length === 0) {
      toast.push("error", "Não há inscritos para imprimir.");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.push("error", "Permita pop-ups para imprimir a listagem.");
      return;
    }
    printWindow.document.write(buildAttendanceListHtml(list));
    printWindow.document.close();
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
                ["all", "Todos"],
                ["upcoming", "Próximos"],
                ["past", "Passados"],
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
          <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar evento, nome, e-mail ou telefone…"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading || groups.length === 0}
              onClick={() => printAttendanceLists(groups)}
              className="shrink-0"
            >
              <Printer className="mr-1.5 h-4 w-4" />
              Imprimir listagens
            </Button>
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

        {debouncedQuery ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-[var(--text-secondary)]">
            <span>
              Busca ativa: só aparecem inscritos que batem com “{debouncedQuery}”. Limpe a busca para ver todos.
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
              }}
            >
              Limpar busca
            </Button>
          </div>
        ) : null}

        {scope !== "all" ? (
          <p className="text-xs text-[var(--text-muted)]">
            Filtro “{scope === "upcoming" ? "Próximos" : "Passados"}” ativo — inscritos de outras datas ficam
            ocultos. Use “Todos” para ver a listagem completa.
          </p>
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
          <ul className="flex list-none flex-col gap-3 pl-0">
            {groups.map((group) => {
              const isOpen = expanded.has(group.key);
              const eventName = group.holiday.name?.trim() || "Evento sem nome";
              const isAdding = addingFor === group.key;
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
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            window.location.assign(
                              `/holidays/eventos/${group.holidayId}/checkin?data=${group.occurrenceDate}`,
                            )
                          }
                        >
                          <UserCheck className="mr-1 h-4 w-4" />
                          Check-in e sorteios
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => exportGroupXlsx(group)}
                          disabled={exportingKey === group.key}
                        >
                          <FileSpreadsheet className="mr-1 h-4 w-4" />
                          {exportingKey === group.key ? "Gerando…" : "Exportar Excel"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => printAttendanceLists([group])}
                        >
                          <Printer className="mr-1 h-4 w-4" />
                          Imprimir
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => openAddForm(group.key)}>
                          <Plus className="mr-1 h-4 w-4" />
                          Adicionar inscrito
                        </Button>
                      </div>

                      {isAdding ? (
                        <div className="mt-3 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]/40 p-3">
                          <div className="mb-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setMode("guest")}
                              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                mode === "guest"
                                  ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                                  : "border-[var(--card-border)] bg-white"
                              }`}
                            >
                              Sem conta
                            </button>
                            <button
                              type="button"
                              onClick={() => setMode("user")}
                              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                mode === "user"
                                  ? "border-[var(--igh-primary)] bg-[var(--igh-primary)] text-white"
                                  : "border-[var(--card-border)] bg-white"
                              }`}
                            >
                              Usuário existente (e-mail)
                            </button>
                          </div>
                          {mode === "user" ? (
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
                                  <Input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} type="email" />
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
                            <Button type="button" variant="secondary" size="sm" onClick={() => setAddingFor(null)}>
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={saving}
                              onClick={() => void submitAdd(group.holidayId, group.occurrenceDate)}
                            >
                              {saving ? "Salvando…" : "Salvar"}
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      <TableShell className="mt-3">
                        <thead>
                          <tr>
                            <Th>Participante</Th>
                            <Th>Contato</Th>
                            <Th>Presença</Th>
                            <Th>Indicação</Th>
                            <Th>Inscrito em</Th>
                            <Th>E-mails</Th>
                            <Th className="w-20">Ações</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.length === 0 ? (
                            <tr>
                              <Td colSpan={7} className="text-center text-[var(--text-muted)]">
                                Nenhum inscrito nesta data ainda. Use “Adicionar inscrito”.
                              </Td>
                            </tr>
                          ) : (
                            group.items.map((row) => (
                            <tr
                              key={row.id}
                              className={
                                highlightId === row.id
                                  ? "bg-amber-100/80 dark:bg-amber-900/30"
                                  : undefined
                              }
                            >
                              <Td className="font-medium">
                                {participantName(row)}
                                {!row.user ? (
                                  <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide text-[var(--text-muted)]">
                                    Sem conta
                                  </span>
                                ) : null}
                                {row.checkinCode ? (
                                  <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide text-[var(--text-muted)]">
                                    Código {row.checkinCode}
                                  </span>
                                ) : null}
                              </Td>
                              <Td className="text-[var(--text-secondary)]">
                                <div className="flex flex-col gap-0.5 text-xs">
                                  <span>{participantEmail(row)}</span>
                                  <span>{participantPhone(row)}</span>
                                  {row.guestCpf ? <span>CPF: {row.guestCpf}</span> : null}
                                </div>
                              </Td>
                              <Td>
                                <div className="flex flex-col items-start gap-1">
                                  {row.present === true ? (
                                    <Badge tone="green">Presente</Badge>
                                  ) : row.present === false ? (
                                    <Badge tone="red">Ausente</Badge>
                                  ) : (
                                    <Badge tone="zinc">Não confirmado</Badge>
                                  )}
                                  {row.raffleTicket ? (
                                    <Badge tone="amber">Nº {row.raffleTicket.number}</Badge>
                                  ) : null}
                                </div>
                              </Td>
                              <Td className="text-xs text-[var(--text-secondary)]">
                                {row.referrerUser?.name ?? "—"}
                              </Td>
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
                              <Td>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={deletingId === row.id}
                                  onClick={() => void removeRegistration(row.id)}
                                  aria-label="Excluir inscrição"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </Td>
                            </tr>
                            ))
                          )}
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
