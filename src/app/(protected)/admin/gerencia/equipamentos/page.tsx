"use client";

import { Package, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";

type Equipment = {
  id: string;
  name: string;
  quantityPerKit: number;
  sortOrder: number;
  isActive: boolean;
};

export default function EquipamentosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Equipment[]>([]);
  const [name, setName] = useState("");
  const [quantityPerKit, setQuantityPerKit] = useState("0");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("0");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gerencia/equipamentos", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ items: Equipment[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar equipamentos.");
        return;
      }
      setItems(json.data.items);
    } catch {
      toast.push("error", "Falha ao carregar equipamentos.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveNew() {
    if (!name.trim()) {
      toast.push("error", "Informe o nome do item.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/gerencia/equipamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          quantityPerKit: Number(quantityPerKit) || 0,
          sortOrder: items.length,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ item: Equipment }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", "Equipamento cadastrado.");
      setName("");
      setQuantityPerKit("0");
      void load();
    } catch {
      toast.push("error", "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: Equipment) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(String(item.quantityPerKit));
  }

  async function saveEdit() {
    if (!editingId) return;
    const res = await fetch(`/api/admin/gerencia/equipamentos/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        quantityPerKit: Number(editQty) || 0,
      }),
    });
    const json = (await res.json()) as ApiResponse<{ item: Equipment }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao atualizar.");
      return;
    }
    toast.push("success", "Equipamento atualizado.");
    setEditingId(null);
    void load();
  }

  async function remove(item: Equipment) {
    if (!confirm(`Remover "${item.name}"?`)) return;
    const res = await fetch(`/api/admin/gerencia/equipamentos/${item.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ archived: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao remover.");
      return;
    }
    toast.push("success", "Equipamento removido.");
    void load();
  }

  const kitCount = items.filter((i) => i.isActive && i.quantityPerKit > 0).length;

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência"
        title="Itens / Equipamentos"
        description="Catálogo de tipos usados nos kits de doação. O saldo fica no Almoxarifado."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Cadastrados" value={loading ? "—" : items.length} icon={Package} />
        <StatTile
          label="No kit padrão"
          value={loading ? "—" : kitCount}
          icon={Package}
          accent="emerald"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <SectionCard title="Novo equipamento" description="Nome do tipo de item." variant="elevated">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm">Nome do item</span>
              <Input
                placeholder="Ex: Monitor"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm">Qtd por kit (0 = só extra)</span>
              <Input
                type="number"
                min={0}
                value={quantityPerKit}
                onChange={(e) => setQuantityPerKit(e.target.value)}
              />
            </label>
            <Button onClick={() => void saveNew()} disabled={saving} className="w-full">
              <Plus className="mr-1.5 h-4 w-4" />
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Lista" description="Tipos disponíveis para doação." variant="elevated">
          <Table>
            <thead>
              <tr>
                <Th>Nome do item</Th>
                <Th>Por kit</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <Td>
                    {editingId === item.id ? (
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    ) : (
                      <span className="font-medium">{item.name}</span>
                    )}
                  </Td>
                  <Td>
                    {editingId === item.id ? (
                      <Input
                        className="w-20"
                        type="number"
                        min={0}
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                      />
                    ) : item.quantityPerKit > 0 ? (
                      item.quantityPerKit
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Badge tone={item.isActive ? "green" : "zinc"}>
                      {item.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {editingId === item.id ? (
                        <>
                          <Button size="sm" onClick={() => void saveEdit()}>
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => startEdit(item)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void remove(item)}>
                            Excluir
                          </Button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <Td colSpan={4}>
                    <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                      Nenhum equipamento cadastrado.
                    </p>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </SectionCard>
      </div>
    </PanelPageStack>
  );
}
