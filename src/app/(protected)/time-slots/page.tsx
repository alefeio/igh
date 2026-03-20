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

type TimeSlot = {
  id: string;
  startTime: string;
  endTime: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function TimeSlotsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TimeSlot[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TimeSlot | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(
    () => startTime.trim().length >= 3 && endTime.trim().length >= 3,
    [startTime, endTime]
  );

  function resetForm() {
    setStartTime("08:00");
    setEndTime("10:00");
    setName("");
    setIsActive(true);
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(slot: TimeSlot) {
    setEditing(slot);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setName(slot.name ?? "");
    setIsActive(slot.isActive);
    setOpen(true);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/time-slots");
      const json = (await res.json()) as ApiResponse<{ timeSlots: TimeSlot[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar horários.");
        return;
      }
      setItems(json.data.timeSlots);
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
      const payload = {
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        name: name.trim() || undefined,
        isActive,
      };

      if (editing) {
        const res = await fetch(`/api/time-slots/${editing.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as ApiResponse<{ timeSlot: TimeSlot }>;
        if (!res.ok || !json.ok) {
          toast.push("error", !json.ok ? json.error.message : "Falha ao atualizar horário.");
          return;
        }
        toast.push("success", "Horário atualizado.");
      } else {
        const res = await fetch("/api/time-slots", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as ApiResponse<{ timeSlot: TimeSlot }>;
        if (!res.ok || !json.ok) {
          toast.push("error", !json.ok ? json.error.message : "Falha ao criar horário.");
          return;
        }
        toast.push("success", "Horário criado.");
      }
      setOpen(false);
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function inactivateSlot(slot: TimeSlot) {
    const res = await fetch(`/api/time-slots/${slot.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    const json = (await res.json()) as ApiResponse<{ timeSlot: TimeSlot }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao inativar horário.");
      return;
    }
    toast.push("success", "Horário inativado.");
    await load();
  }

  async function reactivateSlot(slot: TimeSlot) {
    const res = await fetch(`/api/time-slots/${slot.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const json = (await res.json()) as ApiResponse<{ timeSlot: TimeSlot }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao reativar horário.");
      return;
    }
    toast.push("success", "Horário reativado.");
    await load();
  }

  async function deleteSlot(slot: TimeSlot) {
    const label = slot.name || `${slot.startTime} - ${slot.endTime}`;
    if (!confirm(`Excluir definitivamente o horário "${label}"?`)) return;
    const res = await fetch(`/api/time-slots/${slot.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir horário.");
      return;
    }
    toast.push("success", "Horário excluído.");
    await load();
  }

  const visibleItems = showInactive ? items : items.filter((s) => s.isActive);

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <DashboardHero
        eyebrow="Cadastros"
        title="Horários predefinidos"
        description="Cadastre início e fim para usar ao criar turmas e evitar erros de digitação."
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
              Novo horário
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
                <Th>Início</Th>
                <Th>Fim</Th>
                <Th>Nome (opcional)</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((s) => (
                <tr key={s.id}>
                  <Td>{s.startTime}</Td>
                  <Td>{s.endTime}</Td>
                  <Td>{s.name ?? "-"}</Td>
                  <Td>
                    {s.isActive ? (
                      <Badge tone="green">Ativo</Badge>
                    ) : (
                      <Badge tone="red">Inativo</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEdit(s)}>
                        Editar
                      </Button>
                      {s.isActive ? (
                        <Button
                          variant="secondary"
                          onClick={() => inactivateSlot(s)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Inativar
                        </Button>
                      ) : (
                        <>
                          <Button variant="secondary" onClick={() => reactivateSlot(s)}>
                            Reativar
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => deleteSlot(s)}
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
                  <Td colSpan={5} className="text-[var(--text-secondary)]">
                    {showInactive ? "Nenhum horário encontrado." : "Nenhum horário ativo. Cadastre um novo horário."}
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </TableShell>
        )}
      </SectionCard>

      <Modal
        open={open}
        title={editing ? "Editar horário" : "Novo horário"}
        onClose={() => { setOpen(false); resetForm(); }}
      >
        <form className="flex flex-col gap-3" onSubmit={save}>
          <div>
            <label className="text-sm font-medium">Hora de início (HH:mm)</label>
            <div className="mt-1">
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Hora de fim (HH:mm)</label>
            <div className="mt-1">
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Nome (opcional)</label>
            <div className="mt-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: 9h-10h15" />
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
