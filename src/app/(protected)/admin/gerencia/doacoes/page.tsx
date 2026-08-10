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
import {
  DEFAULT_DONATION_KIT,
  describeDonationKit,
  expandDonationKitItems,
  mergeDonationItems,
  type DonationKitComponent,
} from "@/lib/donation-kits";
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

type ExtraItem = {
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
  kitsCount: number;
  belongsTo: string;
  placeDateText: string;
  templateId: string;
  generatePdf: boolean;
  confirmNow: boolean;
  postInventory: boolean;
  postFinancial: boolean;
  extras: ExtraItem[];
};

function emptyForm(): FormState {
  const today = new Date();
  const place = `Belém, ${today.getDate()} de ${today.toLocaleDateString("pt-BR", { month: "long" })} de ${today.getFullYear()}`;
  return {
    donatariaId: "",
    kind: "BENS",
    donatedAt: today.toISOString().slice(0, 10),
    description: "",
    amount: "",
    kitsCount: 1,
    belongsTo: "",
    placeDateText: place,
    templateId: "",
    generatePdf: true,
    confirmNow: true,
    postInventory: true,
    postFinancial: true,
    extras: [],
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
  const [kitComponents, setKitComponents] = useState<DonationKitComponent[]>([
    ...DEFAULT_DONATION_KIT,
  ]);

  const kitDescription = useMemo(() => describeDonationKit(kitComponents), [kitComponents]);

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

      const [dRes, donRes, invRes, tplRes, eqRes] = await Promise.all([
        fetch(`/api/admin/gerencia/doacoes?${sp.toString()}`, { cache: "no-store" }),
        fetch("/api/admin/gerencia/donatarias", { cache: "no-store" }),
        fetch("/api/admin/gerencia/almoxarifado/itens", { cache: "no-store" }),
        fetch("/api/admin/gerencia/modelos", { cache: "no-store" }),
        fetch("/api/admin/gerencia/equipamentos", { cache: "no-store" }),
      ]);

      const dJson = (await dRes.json()) as ApiResponse<{ donations: DonationView[] }>;
      const donJson = (await donRes.json()) as ApiResponse<{ donatarias: DonatariaView[] }>;
      const invJson = (await invRes.json()) as ApiResponse<{ items: InventoryItemView[] }>;
      const tplJson = (await tplRes.json()) as ApiResponse<{ templates: TemplateOption[] }>;
      const eqJson = (await eqRes.json()) as ApiResponse<{
        kitComponents: DonationKitComponent[];
      }>;

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
      if (eqRes.ok && eqJson.ok && eqJson.data.kitComponents.length > 0) {
        setKitComponents(eqJson.data.kitComponents);
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

  const previewItems = useMemo(() => {
    const kitLines = expandDonationKitItems(form.kitsCount, kitComponents);
    const extras = form.extras
      .filter((e) => e.name.trim() && Number(e.quantity) > 0)
      .map((e) => ({
        name: e.name.trim(),
        quantity: Number(e.quantity),
        unit: e.unit || "UN",
        inventoryItemId: e.inventoryItemId || null,
      }));
    return mergeDonationItems(kitLines, extras);
  }, [form.kitsCount, form.extras, kitComponents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return donations;
    return donations.filter((d) => {
      const hay = `${d.donataria.name} ${d.description ?? ""} ${d.belongsTo ?? ""} ${DONATION_KIND_LABEL[d.kind]}`.toLowerCase();
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

  function setExtra(index: number, patch: Partial<ExtraItem>) {
    setForm((prev) => {
      const extras = [...prev.extras];
      extras[index] = { ...extras[index], ...patch };
      return { ...prev, extras };
    });
  }

  function onPickExtraInventory(index: number, inventoryItemId: string) {
    const inv = inventory.find((i) => i.id === inventoryItemId);
    setExtra(index, {
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
    const showGoods = form.kind === "BENS" || form.kind === "MISTO";
    if (showGoods && previewItems.length === 0) {
      toast.push("error", "Informe kits ou itens extras.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/gerencia/doacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          donatariaId: form.donatariaId,
          kind: form.kind,
          donatedAt: form.donatedAt,
          description: form.description.trim() || null,
          amount: form.kind === "BENS" ? null : form.amount,
          kitsCount: showGoods ? form.kitsCount : 0,
          belongsTo: form.belongsTo.trim() || null,
          placeDateText: form.placeDateText.trim() || null,
          templateId: form.templateId || null,
          generatePdf: form.generatePdf,
          confirmNow: form.confirmNow,
          postInventory: form.postInventory,
          postFinancial: form.postFinancial,
          items: showGoods
            ? previewItems.map((i) => ({
                inventoryItemId: i.inventoryItemId,
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
              }))
            : [],
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
        description="Termos de saída com kits, itens extras e PDF."
        rightSlot={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo termo
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

      <SectionCard title="Histórico de termos" description="Doações de saída registradas." variant="elevated">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              className="pl-9"
              placeholder="Buscar donatária, pertence a…"
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
              <Th>Nº</Th>
              <Th>Data</Th>
              <Th>Donatária</Th>
              <Th>Kits / itens</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <Td className="whitespace-nowrap font-medium">
                  {d.termNumber != null ? `#${d.termNumber}` : "—"}
                </Td>
                <Td className="whitespace-nowrap">{formatDonationDate(d.donatedAt)}</Td>
                <Td>
                  <div className="font-medium">{d.donataria.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {d.donataria.document || d.belongsTo || "—"}
                  </div>
                </Td>
                <Td>
                  {d.kitsCount > 0 ? (
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {d.kitsCount} kit{d.kitsCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    formatDonationAmount(d.amountCents)
                  )}
                  {d.items.length > 0 ? (
                    <div className="text-xs text-[var(--text-muted)]">
                      {d.items
                        .slice(0, 3)
                        .map((i) => `${i.quantity} ${i.name}`)
                        .join("; ")}
                      {d.items.length > 3 ? "…" : ""}
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

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Novo termo de doação">
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
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Pertence a</span>
            <Input
              placeholder="Pessoa, político ou entidade"
              value={form.belongsTo}
              onChange={(e) => setForm((f) => ({ ...f, belongsTo: e.target.value }))}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Local e data por extenso</span>
            <Input
              value={form.placeDateText}
              onChange={(e) => setForm((f) => ({ ...f, placeDateText: e.target.value }))}
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
            <div className="sm:col-span-2 space-y-3 rounded-md border border-[var(--card-border)] p-3">
              <p className="text-sm text-[var(--text-muted)]">
                Cada kit contém: {kitDescription}.
              </p>
              <label className="flex flex-wrap items-center gap-3 text-sm">
                <span>Quantidade de kits</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, kitsCount: Math.max(0, f.kitsCount - 1) }))
                    }
                  >
                    −
                  </Button>
                  <Input
                    className="w-20 text-center"
                    type="number"
                    min={0}
                    value={form.kitsCount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, kitsCount: Math.max(0, Number(e.target.value) || 0) }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, kitsCount: f.kitsCount + 1 }))}
                  >
                    +
                  </Button>
                </div>
              </label>

              <Table>
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th>Qtd</Th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item, idx) => (
                    <tr key={`${item.name}-${idx}`}>
                      <Td>{item.name}</Td>
                      <Td>{String(item.quantity).padStart(2, "0")}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Itens extras (opcional)</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        extras: [
                          ...f.extras,
                          { inventoryItemId: "", name: "", quantity: "1", unit: "UN" },
                        ],
                      }))
                    }
                  >
                    + Extra
                  </Button>
                </div>
                {form.extras.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 rounded-md border border-[var(--card-border)] p-2 sm:grid-cols-4"
                  >
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs text-[var(--text-muted)]">Do estoque</span>
                      <select
                        className={selectClass}
                        value={item.inventoryItemId}
                        onChange={(e) => onPickExtraInventory(idx, e.target.value)}
                      >
                        <option value="">Livre</option>
                        {inventory.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} (saldo {inv.quantityOnHand})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs text-[var(--text-muted)]">Nome</span>
                      <Input
                        value={item.name}
                        onChange={(e) => setExtra(idx, { name: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-[var(--text-muted)]">Qtd</span>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => setExtra(idx, { quantity: e.target.value })}
                      />
                    </label>
                    <div className="flex items-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            extras: f.extras.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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
            Baixar estoque (itens com vínculo)
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
            {saving ? "Salvando…" : form.confirmNow ? "Gerar termo" : "Salvar rascunho"}
          </Button>
        </div>
      </Modal>
    </PanelPageStack>
  );
}
