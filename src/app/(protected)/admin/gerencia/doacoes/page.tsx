"use client";

import { Gift, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import type { DonationKind, DonationStatus } from "@/generated/prisma/client";
import {
  DONATION_KIND_LABEL,
  DONATION_KINDS,
  DONATION_STATUS_LABEL,
  formatDonationAmount,
  formatDonationDate,
  type DonatariaView,
  type DonationView,
  type InventoryItemView,
} from "@/lib/inventory-donations-ui";

type TemplateOption = { id: string; title: string; type: string; isActive: boolean };

type DonationItemDraft = {
  inventoryItemId: string;
  name: string;
  quantity: string;
  unit: string;
};

type FormState = {
  donatariaId: string;
  kind: DonationKind;
  donatedAt: string;
  description: string;
  amount: string;
  templateId: string;
  generatePdf: boolean;
  confirmNow: boolean;
  postInventory: boolean;
  postFinancial: boolean;
  items: DonationItemDraft[];
};

function emptyForm(): FormState {
  return {
    donatariaId: "",
    kind: "BENS",
    donatedAt: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    templateId: "",
    generatePdf: true,
    confirmNow: true,
    postInventory: true,
    postFinancial: true,
    items: [{ inventoryItemId: "", name: "", quantity: "1", unit: "UN" }],
  };
}

function statusTone(status: DonationStatus): "zinc" | "green" | "amber" | "red" {
  if (status === "CONFIRMADA") return "green";
  if (status === "RASCUNHO") return "amber";
  return "red";
}

const selectClass =
  "w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm";

export default function DoacoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState<DonationView[]>([]);
  const [donatarias, setDonatarias] = useState<DonatariaView[]>([]);
  const [inventory, setInventory] = useState<InventoryItemView[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | DonationStatus>("");
  const [kindFilter, setKindFilter] = useState<"" | DonationKind>("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (statusFilter) sp.set("status", statusFilter);
      if (kindFilter) sp.set("kind", kindFilter);

      const [dRes, donRes, invRes, tplRes] = await Promise.all([
        fetch(`/api/admin/gerencia/doacoes?${sp.toString()}`, { cache: "no-store" }),
        fetch("/api/admin/gerencia/donatarias", { cache: "no-store" }),
        fetch("/api/admin/gerencia/almoxarifado/itens", { cache: "no-store" }),
        fetch("/api/admin/gerencia/modelos", { cache: "no-store" }),
      ]);

      const dJson = (await dRes.json()) as ApiResponse<{ donations: DonationView[] }>;
      const donJson = (await donRes.json()) as ApiResponse<{ donatarias: DonatariaView[] }>;
      const invJson = (await invRes.json()) as ApiResponse<{ items: InventoryItemView[] }>;
      const tplJson = (await tplRes.json()) as ApiResponse<{ templates: TemplateOption[] }>;

      if (!dRes.ok || !dJson.ok) {
        toast.push("error", !dJson.ok ? dJson.error.message : "Falha ao carregar doações.");
        return;
      }
      setDonations(dJson.data.donations);
      if (donRes.ok && donJson.ok) {
        setDonatarias(donJson.data.donatarias.filter((d) => d.isActive));
      }
      if (invRes.ok && invJson.ok) {
        setInventory(invJson.data.items.filter((i) => i.isActive));
      }
      if (tplRes.ok && tplJson.ok) {
        setTemplates(tplJson.data.templates.filter((t) => t.type === "TERMO_DOACAO" && t.isActive));
      }
    } catch {
      toast.push("error", "Falha ao carregar doações.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, kindFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return donations;
    return donations.filter((d) => {
      const hay = `${d.donataria.name} ${d.description ?? ""} ${DONATION_KIND_LABEL[d.kind]}`.toLowerCase();
      return hay.includes(q);
    });
  }, [donations, search]);

  const counts = useMemo(() => {
    return {
      total: donations.length,
      rascunho: donations.filter((d) => d.status === "RASCUNHO").length,
      confirmada: donations.filter((d) => d.status === "CONFIRMADA").length,
    };
  }, [donations]);

  function openCreate() {
    setForm(emptyForm());
    setFormOpen(true);
  }

  function setItem(index: number, patch: Partial<DonationItemDraft>) {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], ...patch };
      return { ...prev, items };
    });
  }

  function onPickInventory(index: number, inventoryItemId: string) {
    const inv = inventory.find((i) => i.id === inventoryItemId);
    setItem(index, {
      inventoryItemId,
      name: inv?.name ?? "",
      unit: inv?.unit ?? "UN",
    });
  }

  async function save() {
    if (!form.donatariaId) {
      toast.push("error", "Selecione a donatária.");
      return;
    }
    setSaving(true);
    try {
      const needsItems = form.kind === "BENS" || form.kind === "MISTO";
      const items = needsItems
        ? form.items
            .filter((i) => i.name.trim() && Number(i.quantity) > 0)
            .map((i) => ({
              inventoryItemId: i.inventoryItemId || null,
              name: i.name.trim(),
              quantity: Number(i.quantity),
              unit: i.unit.trim() || "UN",
            }))
        : [];

      const res = await fetch("/api/admin/gerencia/doacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          donatariaId: form.donatariaId,
          kind: form.kind,
          donatedAt: form.donatedAt,
          description: form.description.trim() || null,
          amount: form.kind === "BENS" ? null : form.amount,
          templateId: form.templateId || null,
          generatePdf: form.generatePdf,
          confirmNow: form.confirmNow,
          postInventory: form.postInventory,
          postFinancial: form.postFinancial,
          items,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ donation: DonationView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar doação.");
        return;
      }
      toast.push(
        "success",
        form.confirmNow ? "Doação confirmada." : "Doação salva como rascunho.",
      );
      setFormOpen(false);
      void load();
    } catch {
      toast.push("error", "Falha ao salvar doação.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDonation(id: string) {
    setConfirmingId(id);
    try {
      const res = await fetch(`/api/admin/gerencia/doacoes/${id}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postInventory: true,
          postFinancial: true,
          generatePdf: true,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ donation: DonationView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao confirmar.");
        return;
      }
      toast.push("success", "Doação confirmada.");
      void load();
    } catch {
      toast.push("error", "Falha ao confirmar.");
    } finally {
      setConfirmingId(null);
    }
  }

  async function archiveDonation(d: DonationView) {
    if (!confirm(`Excluir rascunho da doação para ${d.donataria.name}?`)) return;
    const res = await fetch(`/api/admin/gerencia/doacoes/${d.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ archived: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao excluir.");
      return;
    }
    toast.push("success", "Doação removida.");
    void load();
  }

  const showItems = form.kind === "BENS" || form.kind === "MISTO";
  const showAmount = form.kind === "DINHEIRO" || form.kind === "MISTO";

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência"
        title="Doações"
        description="Saídas de bens e/ou dinheiro para donatárias, com termo em PDF."
        rightSlot={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova doação
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Total" value={loading ? "—" : counts.total} icon={Gift} />
        <StatTile
          label="Rascunhos"
          value={loading ? "—" : counts.rascunho}
          icon={Gift}
          accent="amber"
        />
        <StatTile
          label="Confirmadas"
          value={loading ? "—" : counts.confirmada}
          icon={Gift}
          accent="emerald"
        />
      </div>

      <SectionCard title="Registro" description="Histórico de doações de saída." variant="elevated">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              className="pl-9"
              placeholder="Buscar donatária ou descrição…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={selectClass + " w-auto"}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | DonationStatus)}
          >
            <option value="">Todos os status</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="CONFIRMADA">Confirmada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
          <select
            className={selectClass + " w-auto"}
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "" | DonationKind)}
          >
            <option value="">Todos os tipos</option>
            {DONATION_KINDS.map((k) => (
              <option key={k} value={k}>
                {DONATION_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Donatária</Th>
              <Th>Tipo</Th>
              <Th>Valor / Itens</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <Td className="whitespace-nowrap">{formatDonationDate(d.donatedAt)}</Td>
                <Td>
                  <div className="font-medium">{d.donataria.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{d.description || "—"}</div>
                </Td>
                <Td>{DONATION_KIND_LABEL[d.kind]}</Td>
                <Td>
                  <div>{formatDonationAmount(d.amountCents)}</div>
                  {d.items.length > 0 ? (
                    <div className="text-xs text-[var(--text-muted)]">
                      {d.items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join("; ")}
                    </div>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone={statusTone(d.status)}>{DONATION_STATUS_LABEL[d.status]}</Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {d.pdfUrl ? (
                      <a
                        href={d.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[36px] items-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-2.5 py-1.5 text-xs font-medium sm:min-h-0"
                      >
                        PDF
                      </a>
                    ) : null}
                    {d.status === "RASCUNHO" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => void confirmDonation(d.id)}
                          disabled={confirmingId === d.id}
                        >
                          {confirmingId === d.id ? "Confirmando…" : "Confirmar"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void archiveDonation(d)}>
                          Excluir
                        </Button>
                      </>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
            {!loading && filtered.length === 0 ? (
              <tr>
                <Td colSpan={6}>
                  <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                    Nenhuma doação encontrada.
                  </p>
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </SectionCard>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nova doação">
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Donatária</span>
            <select
              className={selectClass}
              value={form.donatariaId}
              onChange={(e) => setForm((f) => ({ ...f, donatariaId: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {donatarias.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Tipo</span>
            <select
              className={selectClass}
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as DonationKind }))}
            >
              {DONATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DONATION_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Data</span>
            <Input
              type="date"
              value={form.donatedAt}
              onChange={(e) => setForm((f) => ({ ...f, donatedAt: e.target.value }))}
            />
          </label>
          {showAmount ? (
            <label className="block">
              <span className="mb-1 block text-sm">Valor (R$)</span>
              <Input
                placeholder="0,00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
          ) : null}
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Descrição</span>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Modelo do termo</span>
            <select
              className={selectClass}
              value={form.templateId}
              onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
            >
              <option value="">Usar o mais recente (se houver)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>

          {showItems ? (
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Itens</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      items: [...f.items, { inventoryItemId: "", name: "", quantity: "1", unit: "UN" }],
                    }))
                  }
                >
                  + Item
                </Button>
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} className="grid gap-2 rounded-md border border-[var(--card-border)] p-2 sm:grid-cols-4">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs text-[var(--text-muted)]">Do estoque</span>
                    <select
                      className={selectClass}
                      value={item.inventoryItemId}
                      onChange={(e) => onPickInventory(idx, e.target.value)}
                    >
                      <option value="">Livre (sem baixa automática)</option>
                      {inventory.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name} (saldo {inv.quantityOnHand})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs text-[var(--text-muted)]">Nome</span>
                    <Input value={item.name} onChange={(e) => setItem(idx, { name: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-[var(--text-muted)]">Qtd</span>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => setItem(idx, { quantity: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-[var(--text-muted)]">Unidade</span>
                    <Input value={item.unit} onChange={(e) => setItem(idx, { unit: e.target.value })} />
                  </label>
                  <div className="flex items-end sm:col-span-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={form.items.length <= 1}
                      onClick={() =>
                        setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
                      }
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.confirmNow}
              onChange={(e) => setForm((f) => ({ ...f, confirmNow: e.target.checked }))}
            />
            Confirmar agora (baixa estoque / financeiro / PDF)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.generatePdf}
              onChange={(e) => setForm((f) => ({ ...f, generatePdf: e.target.checked }))}
            />
            Gerar PDF do termo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.postInventory}
              onChange={(e) => setForm((f) => ({ ...f, postInventory: e.target.checked }))}
            />
            Baixar estoque
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.postFinancial}
              onChange={(e) => setForm((f) => ({ ...f, postFinancial: e.target.checked }))}
            />
            Lançar no financeiro
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setFormOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando…" : form.confirmNow ? "Salvar e confirmar" : "Salvar rascunho"}
          </Button>
        </div>
      </Modal>
    </PanelPageStack>
  );
}
