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

export default function HolidaysPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Holiday[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [recurring, setRecurring] = useState(true);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => date.trim().length >= 10, [date]);

  function resetForm() {
    setRecurring(true);
    setDate("");
    setName("");
    setIsActive(true);
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setDate("2000-01-01");
    setOpen(true);
  }

  function openEdit(h: Holiday) {
    setEditing(h);
    setRecurring(h.recurring);
    setDate(formatDate(h.date));
    setName(h.name ?? "");
    setIsActive(h.isActive);
    setOpen(true);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/holidays");
      const json = (await res.json()) as ApiResponse<{ holidays: Holiday[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar feriados.");
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
      const payload = {
        recurring,
        date: recurring && dateStr.length === 10 ? `2000-${dateStr.slice(5, 10)}` : dateStr,
        name: name.trim() || undefined,
        isActive,
      };

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
          toast.push("error", !json.ok ? json.error.message : "Falha ao atualizar feriado.");
          return;
        }
        toast.push(
          "success",
          successMessageWithSchedule("Feriado atualizado.", json.data.scheduleRecalculation)
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
          toast.push("error", !json.ok ? json.error.message : "Falha ao criar feriado.");
          return;
        }
        toast.push(
          "success",
          successMessageWithSchedule("Feriado criado.", json.data.scheduleRecalculation ?? null)
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
      toast.push("error", !json.ok ? json.error.message : "Falha ao inativar feriado.");
      return;
    }
    toast.push(
      "success",
      successMessageWithSchedule("Feriado inativado.", json.data.scheduleRecalculation)
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
      toast.push("error", !json.ok ? json.error.message : "Falha ao reativar feriado.");
      return;
    }
    toast.push(
      "success",
      successMessageWithSchedule("Feriado reativado.", json.data.scheduleRecalculation)
    );
    await load();
  }

  async function deleteHoliday(h: Holiday) {
    if (!confirm(`Excluir o feriado "${h.name || formatDateDisplay(h.date, h.recurring)}"?`)) return;
    const res = await fetch(`/api/holidays/${h.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{
      deleted: boolean;
      scheduleRecalculation?: ScheduleRecalculation;
    }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir feriado.");
      return;
    }
    toast.push(
      "success",
      successMessageWithSchedule("Feriado excluído.", json.data.scheduleRecalculation)
    );
    await load();
  }

  const visibleItems = showInactive ? items : items.filter((h) => h.isActive);

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Cadastros"
        title="Feriados"
        description="Feriados não geram aulas nas turmas. Por padrão, apenas ativos são exibidos."
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
            <Button onClick={openCreate} className="w-full sm:w-auto">
              Novo feriado
            </Button>
          </div>
        }
      />

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
                <Th>Nome</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((h) => (
                <tr key={h.id}>
                  <Td>{formatDateDisplay(h.date, h.recurring)}</Td>
                  <Td>{h.name ?? "-"}</Td>
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
                  <Td colSpan={4} className="text-[var(--text-secondary)]">
                    {showInactive ? "Nenhum feriado encontrado." : "Nenhum feriado ativo."}
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </TableShell>
        )}
      </SectionCard>

      <Modal
        open={open}
        title={editing ? "Editar feriado" : "Novo feriado"}
        onClose={() => { setOpen(false); resetForm(); }}
      >
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Tipo</label>
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
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {recurring && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                O ano não é usado; o feriado vale para todo ano.
              </p>
            )}
          </div>
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
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>
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
