"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type InventoryPick = {
  id: string;
  name: string;
  quantityOnHand: number;
  minStock: number;
  unit: string;
  lowStock: boolean;
};

type DraftLine = {
  key: string;
  inventoryItemId: string;
  itemName: string;
  kind: "DISPONIVEL" | "FALTANDO";
  quantity: string;
  notes: string;
};

type Report = {
  id: string;
  notes: string | null;
  status: "PENDENTE" | "VISTO";
  reviewNotes: string | null;
  createdAt: string;
  lines: Array<{
    id: string;
    itemName: string;
    kind: "DISPONIVEL" | "FALTANDO";
    quantity: number;
    notes: string | null;
  }>;
};

function emptyLine(): DraftLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    inventoryItemId: "",
    itemName: "",
    kind: "FALTANDO",
    quantity: "1",
    notes: "",
  };
}

export default function ColaboradorLimpezaPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<InventoryPick[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsRes, itemsRes] = await Promise.all([
        fetch("/api/me/colaborador/limpeza", { cache: "no-store" }),
        fetch("/api/me/colaborador/limpeza/itens", { cache: "no-store" }),
      ]);
      const reportsJson = (await reportsRes.json()) as ApiResponse<{ reports: Report[] }>;
      const itemsJson = (await itemsRes.json()) as ApiResponse<{ items: InventoryPick[] }>;
      if (!reportsRes.ok || !reportsJson.ok) {
        toast.push("error", !reportsJson.ok ? reportsJson.error.message : "Falha ao carregar relatos.");
        return;
      }
      if (!itemsRes.ok || !itemsJson.ok) {
        toast.push("error", !itemsJson.ok ? itemsJson.error.message : "Falha ao carregar itens.");
        return;
      }
      setReports(reportsJson.data.reports);
      setItems(itemsJson.data.items);
    } catch {
      toast.push("error", "Falha ao carregar a página de limpeza.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    const payloadLines = lines
      .map((line) => ({
        inventoryItemId: line.inventoryItemId || null,
        itemName: line.itemName.trim(),
        kind: line.kind,
        quantity: Number(line.quantity),
        notes: line.notes.trim() || null,
      }))
      .filter((line) => line.itemName);

    if (!payloadLines.length) {
      toast.push("error", "Inclua ao menos um item com nome.");
      return;
    }
    if (payloadLines.some((l) => !Number.isFinite(l.quantity) || l.quantity < 1)) {
      toast.push("error", "Quantidades devem ser números positivos.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/me/colaborador/limpeza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || null, lines: payloadLines }),
      });
      const json = (await res.json()) as ApiResponse<{ report: Report }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao enviar o relato.");
        return;
      }
      toast.push("success", "Relato enviado à gerência.");
      setNotes("");
      setLines([emptyLine()]);
      void load();
    } catch {
      toast.push("error", "Falha ao enviar o relato.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Portal do colaborador"
        title="Relato de limpeza"
        description="Informe materiais disponíveis no local ou faltando para a gerência acompanhar."
      />

      <SectionCard title="Novo relato" variant="elevated">
        <div className="space-y-3">
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="grid gap-2 rounded-lg border border-[var(--card-border)] p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_100px_auto]"
            >
              <label className="text-xs text-[var(--text-muted)]">
                Item do estoque (opcional)
                <select
                  className="mt-1 w-full rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-2 text-sm"
                  value={line.inventoryItemId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const picked = items.find((i) => i.id === id);
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === index
                          ? {
                              ...l,
                              inventoryItemId: id,
                              itemName: picked?.name ?? l.itemName,
                            }
                          : l,
                      ),
                    );
                  }}
                >
                  <option value="">Nome livre / não listado</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.quantityOnHand} {item.unit}
                      {item.lowStock ? " · baixo" : ""})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[var(--text-muted)]">
                Nome do item
                <Input
                  className="mt-1"
                  value={line.itemName}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === index ? { ...l, itemName: e.target.value } : l)),
                    )
                  }
                  placeholder="Ex.: Detergente"
                />
              </label>
              <label className="text-xs text-[var(--text-muted)]">
                Situação
                <select
                  className="mt-1 w-full rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-2 text-sm"
                  value={line.kind}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === index
                          ? { ...l, kind: e.target.value as DraftLine["kind"] }
                          : l,
                      ),
                    )
                  }
                >
                  <option value="FALTANDO">Faltando</option>
                  <option value="DISPONIVEL">Disponível</option>
                </select>
              </label>
              <label className="text-xs text-[var(--text-muted)]">
                Qtd.
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)),
                    )
                  }
                />
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={lines.length <= 1}
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
              <Plus className="mr-1 h-4 w-4" />
              Adicionar item
            </Button>
          </div>

          <label className="block text-xs text-[var(--text-muted)]">
            Observações gerais (opcional)
            <textarea
              className="mt-1 w-full rounded border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <Button type="button" onClick={() => void submit()} disabled={saving || loading}>
            {saving ? "Enviando…" : "Enviar relato"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Histórico" description={loading ? "Carregando…" : undefined} variant="elevated">
        {reports.length === 0 && !loading ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum relato enviado ainda.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Itens</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap text-xs">
                    {new Date(r.createdAt).toLocaleString("pt-BR")}
                  </Td>
                  <Td>
                    <ul className="space-y-1 text-sm">
                      {r.lines.map((line) => (
                        <li key={line.id}>
                          {line.itemName} · {line.quantity} ·{" "}
                          {line.kind === "FALTANDO" ? "faltando" : "disponível"}
                        </li>
                      ))}
                    </ul>
                    {r.notes ? <p className="mt-1 text-xs text-[var(--text-muted)]">{r.notes}</p> : null}
                  </Td>
                  <Td>
                    <Badge tone={r.status === "PENDENTE" ? "amber" : "green"}>
                      {r.status === "PENDENTE" ? "Pendente" : "Visto"}
                    </Badge>
                    {r.reviewNotes ? (
                      <div className="mt-1 text-xs text-[var(--text-muted)]">{r.reviewNotes}</div>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>
    </PanelPageStack>
  );
}
