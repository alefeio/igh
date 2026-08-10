"use client";

import { AlertTriangle, Package, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import {
  INVENTORY_CONDITION_LABEL,
  INVENTORY_CONDITIONS,
  INVENTORY_MOVEMENT_LABEL,
  INVENTORY_MOVEMENT_TYPES,
  formatCentsBRL,
  type InventoryItemView,
} from "@/lib/inventory-donations-ui";
import type { InventoryCondition, InventoryMovementType } from "@/generated/prisma/client";

type ItemForm = {
  name: string;
  code: string;
  category: string;
  brand: string;
  model: string;
  assetTag: string;
  serialNumber: string;
  unit: string;
  minStock: string;
  location: string;
  responsibleName: string;
  condition: InventoryCondition;
  unitValue: string;
  notes: string;
  isActive: boolean;
  initialQuantity: string;
};

type MovementForm = {
  type: InventoryMovementType;
  quantity: string;
  reason: string;
  notes: string;
};

type ItemDetail = InventoryItemView & {
  movements: Array<{
    id: string;
    type: InventoryMovementType;
    quantity: number;
    quantityDelta: number;
    reason: string | null;
    notes: string | null;
    createdAt: string;
    createdByUser: { id: string; name: string } | null;
  }>;
};

function emptyItemForm(): ItemForm {
  return {
    name: "",
    code: "",
    category: "Geral",
    brand: "",
    model: "",
    assetTag: "",
    serialNumber: "",
    unit: "UN",
    minStock: "0",
    location: "",
    responsibleName: "",
    condition: "BOM",
    unitValue: "",
    notes: "",
    isActive: true,
    initialQuantity: "0",
  };
}

function emptyMovementForm(): MovementForm {
  return { type: "ENTRADA", quantity: "1", reason: "", notes: "" };
}

const selectClass =
  "w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm";

export default function AlmoxarifadoPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItemView[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [estimatedValueCents, setEstimatedValueCents] = useState(0);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItemView | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyItemForm);
  const [saving, setSaving] = useState(false);

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveItem, setMoveItem] = useState<InventoryItemView | null>(null);
  const [moveForm, setMoveForm] = useState<MovementForm>(emptyMovementForm);
  const [moving, setMoving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = lowOnly ? "?lowStock=true" : "";
      const res = await fetch(`/api/admin/gerencia/almoxarifado/itens${qs}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{
        items: InventoryItemView[];
        lowStockCount: number;
        estimatedValueCents?: number;
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar estoque.");
        return;
      }
      setItems(json.data.items);
      setLowStockCount(json.data.lowStockCount);
      setEstimatedValueCents(json.data.estimatedValueCents ?? 0);
    } catch {
      toast.push("error", "Falha ao carregar estoque.");
    } finally {
      setLoading(false);
    }
  }, [lowOnly, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (activeOnly && !item.isActive) return false;
      if (!q) return true;
      const hay = `${item.name} ${item.code ?? ""} ${item.category ?? ""} ${item.location ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, activeOnly]);

  function openCreate() {
    setEditing(null);
    setForm(emptyItemForm());
    setFormOpen(true);
  }

  function openEdit(item: InventoryItemView) {
    setEditing(item);
    setForm({
      name: item.name,
      code: item.code ?? "",
      category: item.category ?? "",
      brand: item.brand ?? "",
      model: item.model ?? "",
      assetTag: item.assetTag ?? "",
      serialNumber: item.serialNumber ?? "",
      unit: item.unit,
      minStock: String(item.minStock),
      location: item.location ?? "",
      responsibleName: item.responsibleName ?? "",
      condition: item.condition ?? "BOM",
      unitValue:
        item.unitValueCents != null
          ? (item.unitValueCents / 100).toFixed(2).replace(".", ",")
          : "",
      notes: item.notes ?? "",
      isActive: item.isActive,
      initialQuantity: "0",
    });
    setFormOpen(true);
  }

  async function saveItem() {
    if (!form.name.trim()) {
      toast.push("error", "Informe o nome do item.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        category: form.category.trim() || null,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        assetTag: form.assetTag.trim() || null,
        serialNumber: form.serialNumber.trim() || null,
        unit: form.unit.trim() || "UN",
        minStock: Number(form.minStock) || 0,
        location: form.location.trim() || null,
        responsibleName: form.responsibleName.trim() || null,
        condition: form.condition,
        unitValue: form.unitValue.trim() || null,
        notes: form.notes.trim() || null,
        isActive: form.isActive,
        ...(editing ? {} : { initialQuantity: Number(form.initialQuantity) || 0 }),
      };
      const res = await fetch(
        editing
          ? `/api/admin/gerencia/almoxarifado/itens/${editing.id}`
          : "/api/admin/gerencia/almoxarifado/itens",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = (await res.json()) as ApiResponse<{ item: InventoryItemView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar item.");
        return;
      }
      toast.push("success", editing ? "Item atualizado." : "Item cadastrado.");
      setFormOpen(false);
      void load();
    } catch {
      toast.push("error", "Falha ao salvar item.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveItem(item: InventoryItemView) {
    if (!confirm(`Arquivar "${item.name}"?`)) return;
    const res = await fetch(`/api/admin/gerencia/almoxarifado/itens/${item.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ archived: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao arquivar.");
      return;
    }
    toast.push("success", "Item arquivado.");
    void load();
  }

  function openMove(item: InventoryItemView) {
    setMoveItem(item);
    setMoveForm(emptyMovementForm());
    setMoveOpen(true);
  }

  async function saveMovement() {
    if (!moveItem) return;
    const quantity = Number(moveForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.push("error", "Quantidade inválida.");
      return;
    }
    setMoving(true);
    try {
      const res = await fetch("/api/admin/gerencia/almoxarifado/movimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: moveItem.id,
          type: moveForm.type,
          quantity,
          reason: moveForm.reason.trim() || null,
          notes: moveForm.notes.trim() || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha no movimento.");
        return;
      }
      toast.push("success", "Movimento registrado.");
      setMoveOpen(false);
      void load();
    } catch {
      toast.push("error", "Falha no movimento.");
    } finally {
      setMoving(false);
    }
  }

  async function openDetail(item: InventoryItemView) {
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/gerencia/almoxarifado/itens/${item.id}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse<{ item: ItemDetail }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar detalhe.");
        setDetailOpen(false);
        return;
      }
      setDetail(json.data.item);
    } catch {
      toast.push("error", "Falha ao carregar detalhe.");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência"
        title="Almoxarifado"
        description="Estoque patrimonial, entradas, saídas e alerta de saldo baixo."
        rightSlot={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo item
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Itens" value={loading ? "—" : items.length} icon={Package} />
        <StatTile
          label="Estoque baixo"
          value={loading ? "—" : lowStockCount}
          icon={AlertTriangle}
          accent="amber"
        />
        <StatTile
          label="Ativos"
          value={loading ? "—" : items.filter((i) => i.isActive).length}
          icon={Package}
          accent="emerald"
        />
        <StatTile
          label="Valor estimado"
          value={loading ? "—" : formatCentsBRL(estimatedValueCents)}
          icon={Package}
          accent="sky"
        />
      </div>

      <SectionCard title="Itens" description="Cadastro e saldo atual." variant="elevated">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              className="pl-9"
              placeholder="Buscar nome, código, categoria…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
            Só estoque baixo
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Só ativos
          </label>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Saldo</Th>
              <Th>Mín.</Th>
              <Th>Valor un.</Th>
              <Th>Local</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <Td>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {[item.code, item.category, item.assetTag, item.unit].filter(Boolean).join(" · ") ||
                      "—"}
                  </div>
                </Td>
                <Td>
                  <span className={item.lowStock ? "font-semibold text-amber-600" : ""}>
                    {item.quantityOnHand}
                  </span>
                </Td>
                <Td>{item.minStock}</Td>
                <Td>{item.unitValueCents != null ? formatCentsBRL(item.unitValueCents) : "—"}</Td>
                <Td>{item.location || "—"}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={item.isActive ? "green" : "zinc"}>
                      {item.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                    {item.lowStock && item.isActive ? <Badge tone="amber">Baixo</Badge> : null}
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" onClick={() => void openDetail(item)}>
                      Histórico
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openMove(item)}>
                      Movimentar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void archiveItem(item)}>
                      Arquivar
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {!loading && filtered.length === 0 ? (
              <tr>
                <Td colSpan={7}>
                  <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                    Nenhum item encontrado.
                  </p>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </SectionCard>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar item" : "Novo item"}
      >
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Nome</span>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Código</span>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Categoria</span>
            <Input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Marca</span>
            <Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Modelo</span>
            <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Tombamento</span>
            <Input
              value={form.assetTag}
              onChange={(e) => setForm((f) => ({ ...f, assetTag: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Nº de série</span>
            <Input
              value={form.serialNumber}
              onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Localização</span>
            <Input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Responsável</span>
            <Input
              value={form.responsibleName}
              onChange={(e) => setForm((f) => ({ ...f, responsibleName: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Conservação</span>
            <select
              className={selectClass}
              value={form.condition}
              onChange={(e) =>
                setForm((f) => ({ ...f, condition: e.target.value as InventoryCondition }))
              }
            >
              {INVENTORY_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {INVENTORY_CONDITION_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Unidade</span>
            <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Estoque mínimo</span>
            <Input
              type="number"
              min={0}
              value={form.minStock}
              onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Valor unitário (R$)</span>
            <Input
              placeholder="0,00"
              value={form.unitValue}
              onChange={(e) => setForm((f) => ({ ...f, unitValue: e.target.value }))}
            />
          </label>
          {!editing ? (
            <label className="block">
              <span className="mb-1 block text-sm">Saldo inicial</span>
              <Input
                type="number"
                min={0}
                value={form.initialQuantity}
                onChange={(e) => setForm((f) => ({ ...f, initialQuantity: e.target.value }))}
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Ativo
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Observações</span>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setFormOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void saveItem()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={moveItem ? `Movimentar — ${moveItem.name}` : "Movimentar"}
      >
        <p className="mb-3 text-sm text-[var(--text-muted)]">
          Saldo atual: <strong>{moveItem?.quantityOnHand ?? "—"}</strong>
          {moveForm.type === "AJUSTE" ? " · Em ajuste, a quantidade é o novo saldo absoluto." : null}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm">Tipo</span>
            <select
              className={selectClass}
              value={moveForm.type}
              onChange={(e) =>
                setMoveForm((f) => ({ ...f, type: e.target.value as InventoryMovementType }))
              }
            >
              {INVENTORY_MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INVENTORY_MOVEMENT_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Quantidade</span>
            <Input
              type="number"
              min={1}
              value={moveForm.quantity}
              onChange={(e) => setMoveForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Motivo</span>
            <Input
              value={moveForm.reason}
              onChange={(e) => setMoveForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Notas</span>
            <Input
              value={moveForm.notes}
              onChange={(e) => setMoveForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setMoveOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void saveMovement()} disabled={moving}>
            {moving ? "Registrando…" : "Registrar"}
          </Button>
        </div>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Histórico do item">
        {detailLoading || !detail ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{detail.name}</strong> — saldo {detail.quantityOnHand} {detail.unit}
            </p>
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Tipo</Th>
                  <Th>Qtd</Th>
                  <Th>Δ</Th>
                  <Th>Motivo</Th>
                </tr>
              </thead>
              <tbody>
                {detail.movements.map((m) => (
                  <tr key={m.id}>
                    <Td className="whitespace-nowrap text-xs">
                      {new Date(m.createdAt).toLocaleString("pt-BR")}
                    </Td>
                    <Td>{INVENTORY_MOVEMENT_LABEL[m.type]}</Td>
                    <Td>{m.quantity}</Td>
                    <Td>{m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}</Td>
                    <Td>{m.reason || "—"}</Td>
                  </tr>
                ))}
                {detail.movements.length === 0 ? (
                  <tr>
                    <Td colSpan={5}>
                      <p className="py-4 text-center text-sm text-[var(--text-muted)]">
                        Sem movimentos.
                      </p>
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        )}
      </Modal>
    </PanelPageStack>
  );
}
