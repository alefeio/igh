"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardHero, SectionCard, TableShell } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Holiday = {
  id: string;
  date: string;
  recurring: boolean;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  eventStartTime: string | null;
  eventEndTime: string | null;
};

type ScheduleRecalculation = {
  classGroupsProcessed: number;
  classGroupsUpdated: number;
};

function successMessageWithSchedule(
  base: string,
  schedule?: ScheduleRecalculation | null
): string {
  if (!schedule || schedule.classGroupsUpdated <= 0) return base;
  return `${base} Calendário de aulas recalculado para ${schedule.classGroupsUpdated} turma(s) não encerradas.`;
}

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

/** Para exibição: recorrente = DD/MM (todo ano), específico = DD/MM/YYYY */
function formatDateDisplay(iso: string, recurring: boolean) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (recurring) return `${d}/${m} (todo ano)`;
  return `${d}/${m}/${y}`;
}

function isTimedEvent(h: Holiday): boolean {
  return !!(h.eventStartTime?.trim() && h.eventEndTime?.trim());
}

function formatHm(isoOrHm: string | null | undefined): string {
  if (!isoOrHm) return "";
  const s = isoOrHm.trim();
  return s.length >= 5 ? s.slice(0, 5) : s;
}

export default function HolidaysPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Holiday[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [kind, setKind] = useState<"holiday" | "event">("holiday");
  const [recurring, setRecurring] = useState(true);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [eventStartTime, setEventStartTime] = useState("08:00");
  const [eventEndTime, setEventEndTime] = useState("11:00");
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => {
    if (date.trim().length < 10) return false;
    if (kind === "event") {
      return eventStartTime.trim().length >= 4 && eventEndTime.trim().length >= 4;
    }
    return true;
  }, [date, kind, eventStartTime, eventEndTime]);

  function resetForm() {
    setKind("holiday");
    setRecurring(true);
    setDate("");
    setName("");
    setIsActive(true);
    setEventStartTime("08:00");
    setEventEndTime("11:00");
    setEditing(null);
  }

  function openCreate(presetKind: "holiday" | "event" = "holiday") {
    resetForm();
    setKind(presetKind);
    setDate("2000-01-01");
    setOpen(true);
  }

  function openEdit(h: Holiday) {
    setEditing(h);
    setRecurring(h.recurring);
    setDate(formatDate(h.date));
    setName(h.name ?? "");
    setIsActive(h.isActive);
    const ev = isTimedEvent(h);
    setKind(ev ? "event" : "holiday");
    setEventStartTime(ev ? formatHm(h.eventStartTime) : "08:00");
    setEventEndTime(ev ? formatHm(h.eventEndTime) : "11:00");
    setOpen(true);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/holidays");
      const json = (await res.json()) as ApiResponse<{ holidays: Holiday[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar registros.");
        return;
      }
      setItems(json.data.holidays);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const dateStr = date.trim();
      const payload: Record<string, unknown> = {
        recurring,
        date: recurring && dateStr.length === 10 ? `2000-${dateStr.slice(5, 10)}` : dateStr,
        name: name.trim() || undefined,
        isActive,
      };
      if (kind === "event") {
        payload.eventStartTime = eventStartTime.trim();
        payload.eventEndTime = eventEndTime.trim();
      } else {
        payload.eventStartTime = null;
        payload.eventEndTime = null;
      }

      if (editing) {
        const res = await fetch(`/api/holidays/${editing.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as ApiResponse<{
          holiday: Holiday;
          scheduleRecalculation?: ScheduleRecalculation;
        }>;
        if (!res.ok || !json.ok) {
          toast.push("error", !json.ok ? json.error.message : "Falha ao atualizar.");
          return;
        }
        toast.push(
          "success",
          successMessageWithSchedule("Registro atualizado.", json.data.scheduleRecalculation)
        );
      } else {
        const res = await fetch("/api/holidays", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as ApiResponse<{
          holiday: Holiday;
          scheduleRecalculation?: ScheduleRecalculation | null;
        }>;
        if (!res.ok || !json.ok) {
          toast.push("error", !json.ok ? json.error.message : "Falha ao criar.");
          return;
        }
        toast.push(
          "success",
          successMessageWithSchedule("Registro criado.", json.data.scheduleRecalculation ?? null)
        );
      }
      setOpen(false);
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function inactivateHoliday(h: Holiday) {
    const res = await fetch(`/api/holidays/${h.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    const json = (await res.json()) as ApiResponse<{
      holiday: Holiday;
      scheduleRecalculation?: ScheduleRecalculation;
    }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao inativar.");
      return;
    }
    toast.push(
      "success",
      successMessageWithSchedule("Registro inativado.", json.data.scheduleRecalculation)
    );
    await load();
  }

  async function reactivateHoliday(h: Holiday) {
    const res = await fetch(`/api/holidays/${h.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const json = (await res.json()) as ApiResponse<{
      holiday: Holiday;
      scheduleRecalculation?: ScheduleRecalculation;
    }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao reativar.");
      return;
    }
    toast.push(
      "success",
      successMessageWithSchedule("Registro reativado.", json.data.scheduleRecalculation)
    );
    await load();
  }

  async function deleteHoliday(h: Holiday) {
    if (!confirm(`Excluir "${h.name || formatDateDisplay(h.date, h.recurring)}"?`)) return;
    const res = await fetch(`/api/holidays/${h.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{
      deleted: boolean;
      scheduleRecalculation?: ScheduleRecalculation;
    }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push(
      "success",
      successMessageWithSchedule("Registro excluído.", json.data.scheduleRecalculation)
    );
    await load();
  }

  const visibleItems = showInactive ? items : items.filter((h) => h.isActive);

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Cadastros"
        title="Eventos e Feriados"
        description="Feriados de dia inteiro não geram aula nesse dia; as aulas são remarcadas para os próximos dias de aula da turma. Eventos com horário só afetam turmas cujo horário cruza o intervalo. Ao salvar, o sistema recalcula automaticamente as sessões das turmas não encerradas."
        rightSlot={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => setShowInactive((prev) => !prev)}
            >
              {showInactive ? "Ocultar inativos" : "Exibir inativos"}
            </Button>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => openCreate("holiday")}>
                Novo feriado
              </Button>
              <Button type="button" className="w-full sm:w-auto" onClick={() => openCreate("event")}>
                Novo evento
              </Button>
            </div>
          </div>
        }
      />

      <SectionCard
        title="Como funciona"
        description="Resumo do impacto no calendário das turmas (mesma lógica da criação de turma)."
        variant="elevated"
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
          <li>
            <strong>Feriado (dia inteiro)</strong>: não há aula nessa data. O sistema gera as sessões
            saltando esse dia e usando apenas os <strong>dias da semana</strong> da turma até completar a carga
            horária do curso (equivalente à lógica de criação da turma).
          </li>
          <li>
            <strong>Evento (com horário)</strong>: só são adiadas as aulas em que o horário da turma (início–fim){" "}
            <strong>cruza</strong> o intervalo do evento. Ex.: evento 08:00–11:00 não altera turmas só à tarde ou
            que começam depois do fim do evento.
          </li>
          <li>
            Ao criar, editar, inativar ou excluir um registro ativo, o calendário das turmas não encerradas é
            recalculado automaticamente.
          </li>
        </ul>
      </SectionCard>

      <SectionCard
        title="Listagem"
        description={
          loading
            ? "Carregando…"
            : `${visibleItems.length} ${visibleItems.length === 1 ? "registro" : "registros"} exibidos.`
        }
        variant="elevated"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-14" role="status">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--igh-primary)]/20" aria-hidden />
            <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando…</p>
          </div>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Tipo</Th>
                <Th>Horário</Th>
                <Th>Nome</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((h) => (
                <tr key={h.id}>
                  <Td>{formatDateDisplay(h.date, h.recurring)}</Td>
                  <Td>
                    {isTimedEvent(h) ? (
                      <Badge tone="amber">Evento</Badge>
                    ) : (
                      <Badge tone="zinc">Feriado</Badge>
                    )}
                  </Td>
                  <Td className="text-[var(--text-secondary)]">
                    {isTimedEvent(h)
                      ? `${formatHm(h.eventStartTime)} – ${formatHm(h.eventEndTime)}`
                      : "—"}
                  </Td>
                  <Td>{h.name ?? "—"}</Td>
                  <Td>
                    {h.isActive ? (
                      <Badge tone="green">Ativo</Badge>
                    ) : (
                      <Badge tone="red">Inativo</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEdit(h)}>
                        Editar
                      </Button>
                      {h.isActive ? (
                        <Button
                          variant="secondary"
                          onClick={() => inactivateHoliday(h)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Inativar
                        </Button>
                      ) : (
                        <>
                          <Button variant="secondary" onClick={() => reactivateHoliday(h)}>
                            Reativar
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => deleteHoliday(h)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Excluir
                          </Button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
              {visibleItems.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="text-[var(--text-secondary)]">
                    {showInactive ? "Nenhum registro encontrado." : "Nenhum registro ativo."}
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </TableShell>
        )}
      </SectionCard>

      <Modal
        open={open}
        title={
          editing
            ? "Editar feriado ou evento"
            : kind === "event"
              ? "Novo evento"
              : "Novo feriado"
        }
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
      >
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="kind"
                  checked={kind === "holiday"}
                  onChange={() => setKind("holiday")}
                />
                <span>Feriado (dia inteiro — sem aula nesse dia)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="kind"
                  checked={kind === "event"}
                  onChange={() => setKind("event")}
                />
                <span>Evento (horário — só turmas que cruzam o intervalo)</span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Recorrência</label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="recurring"
                  checked={recurring}
                  onChange={() => {
                    setRecurring(true);
                    if (date.length === 10) setDate(`2000-${date.slice(5, 10)}`);
                  }}
                />
                <span>Todo ano (mesmo dia e mês)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="recurring"
                  checked={!recurring}
                  onChange={() => {
                    setRecurring(false);
                    if (date.length === 10 && date.startsWith("2000-")) {
                      const y = new Date().getFullYear();
                      setDate(`${y}-${date.slice(5, 10)}`);
                    }
                  }}
                />
                <span>Data específica (com ano)</span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">
              {recurring ? "Dia e mês (todo ano)" : "Data"}
            </label>
            <div className="mt-1">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {recurring && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                O ano não é usado; o registro vale para todo ano.
              </p>
            )}
          </div>
          {kind === "event" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Início do evento</label>
                <div className="mt-1">
                  <Input
                    type="time"
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Fim do evento</label>
                <div className="mt-1">
                  <Input
                    type="time"
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)] sm:col-span-2">
                Turmas com horário que não cruza este intervalo mantêm aula normalmente neste dia.
              </p>
            </div>
          ) : null}
          <div>
            <label className="text-sm font-medium">Nome (opcional)</label>
            <div className="mt-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          {editing ? (
            <div>
              <label className="text-sm font-medium">Ativo</label>
              <div className="mt-1">
                <select
                  className="theme-input h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-[var(--igh-primary)]"
                  value={isActive ? "true" : "false"}
                  onChange={(e) => setIsActive(e.target.value === "true")}
                >
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || saving}>
              {saving ? "Salvando" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
