"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Holiday = {
  id: string;
  date: string;
  recurring: boolean;
  name: string | null;
  isActive: boolean;
  createdAt: string;
};

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
    if (!canSubmit) return;

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
      const json = (await res.json()) as ApiResponse<{ holiday: Holiday }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao atualizar feriado.");
        return;
      }
      toast.push("success", "Feriado atualizado.");
    } else {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResponse<{ holiday: Holiday }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao criar feriado.");
        return;
      }
      toast.push("success", "Feriado criado.");
    }
    setOpen(false);
    resetForm();
    await load();
  }

  async function inactivateHoliday(h: Holiday) {
    const res = await fetch(`/api/holidays/${h.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    const json = (await res.json()) as ApiResponse<{ holiday: Holiday }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao inativar feriado.");
      return;
    }
    toast.push("success", "Feriado inativado.");
    await load();
  }

  async function reactivateHoliday(h: Holiday) {
    const res = await fetch(`/api/holidays/${h.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const json = (await res.json()) as ApiResponse<{ holiday: Holiday }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao reativar feriado.");
      return;
    }
    toast.push("success", "Feriado reativado.");
    await load();
  }

  async function deleteHoliday(h: Holiday) {
    if (!confirm(`Excluir o feriado "${h.name || formatDateDisplay(h.date, h.recurring)}"?`)) return;
    const res = await fetch(`/api/holidays/${h.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir feriado.");
      return;
    }
    toast.push("success", "Feriado excluído.");
    await load();
  }

  const visibleItems = showInactive ? items : items.filter((h) => h.isActive);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-lg font-semibold">Feriados</div>
          <div className="text-sm text-[var(--text-secondary)]">
            Feriados não geram aulas nas turmas. Por padrão, apenas ativos são exibidos.
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowInactive((prev) => !prev)}
          >
            {showInactive ? "Ocultar inativos" : "Exibir inativos"}
          </Button>
          <Button onClick={openCreate} className="w-full sm:w-auto">Novo feriado</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-[var(--text-secondary)]">Carregando...</div>
      ) : (
        <Table>
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
                  <div className="flex justify-end gap-2">
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
        </Table>
      )}

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
            <Button type="submit" disabled={!canSubmit}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
