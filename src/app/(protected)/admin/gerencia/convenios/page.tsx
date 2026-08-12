"use client";

import { Columns3, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import { formatCentsBRL } from "@/lib/employees";

type Column = { id: string; name: string; sortOrder: number };
type BoardEmployee = {
  id: string;
  name: string;
  cpf: string;
  positionLabel: string;
  status: string;
  monthlyPayCents: number | null;
  paymentAgreementId: string | null;
};

const UNASSIGNED = "__none__";

export default function ConveniosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<Column[]>([]);
  const [employees, setEmployees] = useState<BoardEmployee[]>([]);
  const [newColumnName, setNewColumnName] = useState("");
  const [savingColumn, setSavingColumn] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gerencia/convenios", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{
        columns: Column[];
        employees: BoardEmployee[];
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar convênios.");
        return;
      }
      setColumns(json.data.columns);
      setEmployees(json.data.employees);
      const drafts: Record<string, string> = {};
      for (const e of json.data.employees) {
        drafts[e.id] =
          e.monthlyPayCents != null
            ? (e.monthlyPayCents / 100).toFixed(2).replace(".", ",")
            : "";
      }
      setPayDraft(drafts);
    } catch {
      toast.push("error", "Falha ao carregar convênios.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const byColumn = useMemo(() => {
    const map = new Map<string, BoardEmployee[]>();
    map.set(UNASSIGNED, []);
    for (const c of columns) map.set(c.id, []);
    for (const e of employees) {
      const key = e.paymentAgreementId ?? UNASSIGNED;
      const list = map.get(key) ?? map.get(UNASSIGNED)!;
      list.push(e);
    }
    return map;
  }, [columns, employees]);

  async function addColumn() {
    if (!newColumnName.trim()) {
      toast.push("error", "Informe o nome do convênio.");
      return;
    }
    setSavingColumn(true);
    try {
      const res = await fetch("/api/admin/gerencia/convenios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newColumnName.trim(),
          sortOrder: columns.length,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ column: Column }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao criar coluna.");
        return;
      }
      setNewColumnName("");
      toast.push("success", "Convênio criado.");
      void load();
    } catch {
      toast.push("error", "Falha ao criar coluna.");
    } finally {
      setSavingColumn(false);
    }
  }

  async function moveEmployee(employeeId: string, columnId: string | null, alsoPay?: boolean) {
    const body: { paymentAgreementId: string | null; monthlyPay?: string | null } = {
      paymentAgreementId: columnId,
    };
    if (alsoPay) {
      body.monthlyPay = payDraft[employeeId]?.trim() || null;
    }
    const res = await fetch(`/api/admin/gerencia/convenios/mover/${employeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as ApiResponse<{ employee: BoardEmployee }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao mover.");
      return false;
    }
    setEmployees((prev) => prev.map((e) => (e.id === employeeId ? json.data.employee : e)));
    return true;
  }

  async function savePay(employeeId: string) {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const ok = await moveEmployee(employeeId, emp.paymentAgreementId, true);
    if (ok) toast.push("success", "Valor atualizado.");
  }

  async function renameColumn(col: Column) {
    const name = window.prompt("Novo nome do convênio", col.name)?.trim();
    if (!name || name === col.name) return;
    const res = await fetch(`/api/admin/gerencia/convenios/${col.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = (await res.json()) as ApiResponse<{ column: Column }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao renomear.");
      return;
    }
    toast.push("success", "Convênio renomeado.");
    void load();
  }

  async function deleteColumn(col: Column) {
    if (
      !confirm(
        `Excluir o convênio "${col.name}"? Os colaboradores voltam para a fila sem convênio.`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/gerencia/convenios/${col.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ archived: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Convênio removido.");
    void load();
  }

  function onDrop(columnId: string | null) {
    if (!draggingId) return;
    void moveEmployee(draggingId, columnId);
    setDraggingId(null);
  }

  const boardColumns: Array<{ id: string | null; name: string }> = [
    { id: null, name: "Sem convênio (fila)" },
    ...columns.map((c) => ({ id: c.id, name: c.name })),
  ];

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Pessoas"
        title="Convênios de pagamento"
        description="Organize os colaboradores por convênio, altere valores e mova cada pessoa entre colunas."
      />

      <SectionCard title="Nova coluna" description="Crie um tipo de convênio no quadro." variant="elevated">
        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-[220px] flex-1"
            placeholder="Nome do convênio"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
          />
          <Button onClick={() => void addColumn()} disabled={savingColumn}>
            <Plus className="mr-1.5 h-4 w-4" />
            {savingColumn ? "Salvando…" : "Adicionar"}
          </Button>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Dica: arraste um cartão para outra coluna ou use o seletor do próprio cartão.
        </p>
      </SectionCard>

      {loading ? (
        <SectionCard title="Quadro" description="Carregando…" variant="elevated">
          <div className="flex items-center gap-2 py-10 text-sm text-[var(--text-muted)]">
            <Columns3 className="h-4 w-4 animate-pulse" />
            Carregando quadro…
          </div>
        </SectionCard>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {boardColumns.map((col) => {
            const list = byColumn.get(col.id ?? UNASSIGNED) ?? [];
            return (
              <div
                key={col.id ?? UNASSIGNED}
                className="w-[280px] shrink-0 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(col.id)}
              >
                <div className="border-b border-[var(--card-border)] px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{col.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{list.length} pessoa(s)</div>
                    </div>
                    {col.id ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void renameColumn(columns.find((c) => c.id === col.id)!)}
                        >
                          Renomear
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void deleteColumn(columns.find((c) => c.id === col.id)!)}
                        >
                          Excluir
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
                  {list.map((emp) => (
                    <div
                      key={emp.id}
                      draggable
                      onDragStart={() => setDraggingId(emp.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className="cursor-grab rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 active:cursor-grabbing"
                    >
                      <div className="text-sm font-medium">{emp.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{emp.positionLabel}</div>
                      <div className="mt-2 flex items-center gap-1">
                        <Input
                          className="h-8 text-xs"
                          placeholder="Valor R$"
                          value={payDraft[emp.id] ?? ""}
                          onChange={(e) =>
                            setPayDraft((prev) => ({ ...prev, [emp.id]: e.target.value }))
                          }
                        />
                        <Button size="sm" variant="secondary" onClick={() => void savePay(emp.id)}>
                          OK
                        </Button>
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        Atual:{" "}
                        {emp.monthlyPayCents != null ? formatCentsBRL(emp.monthlyPayCents) : "—"}
                      </div>
                      <select
                        className="mt-2 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1 text-xs"
                        value={emp.paymentAgreementId ?? ""}
                        onChange={(e) =>
                          void moveEmployee(emp.id, e.target.value ? e.target.value : null)
                        }
                      >
                        <option value="">Sem convênio (fila)</option>
                        {columns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {list.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-[var(--text-muted)]">
                      Arraste um colaborador para cá
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelPageStack>
  );
}
