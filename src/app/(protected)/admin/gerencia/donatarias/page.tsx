"use client";

import { Building2, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard, StatTile } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Td, Th } from "@/components/ui/Table";
import type { ApiResponse } from "@/lib/api-types";
import type { DonatariaZone } from "@/generated/prisma/client";
import {
  DONATARIA_ZONE_LABEL,
  DONATARIA_ZONES,
  type DonatariaView,
} from "@/lib/inventory-donations-ui";

type FormState = {
  name: string;
  document: string;
  email: string;
  phone: string;
  contactName: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zone: DonatariaZone;
  notes: string;
  isActive: boolean;
};

function emptyForm(): FormState {
  return {
    name: "",
    document: "",
    email: "",
    phone: "",
    contactName: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zone: "URBANA",
    notes: "",
    isActive: true,
  };
}

export default function DonatariasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [donatarias, setDonatarias] = useState<DonatariaView[]>([]);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DonatariaView | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gerencia/donatarias", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ donatarias: DonatariaView[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar donatárias.");
        return;
      }
      setDonatarias(json.data.donatarias);
    } catch {
      toast.push("error", "Falha ao carregar donatárias.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return donatarias.filter((d) => {
      if (activeOnly && !d.isActive) return false;
      if (!q) return true;
      const hay = `${d.name} ${d.document ?? ""} ${d.contactName ?? ""} ${d.city ?? ""} ${d.email ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [donatarias, search, activeOnly]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(d: DonatariaView) {
    setEditing(d);
    setForm({
      name: d.name,
      document: d.document ?? "",
      email: d.email ?? "",
      phone: d.phone ?? "",
      contactName: d.contactName ?? "",
      cep: d.cep ?? "",
      street: d.street ?? "",
      number: d.number ?? "",
      complement: d.complement ?? "",
      neighborhood: d.neighborhood ?? "",
      city: d.city ?? "",
      state: d.state ?? "",
      zone: d.zone ?? "URBANA",
      notes: d.notes ?? "",
      isActive: d.isActive,
    });
    setFormOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.push("error", "Informe o nome da donatária.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        document: form.document.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        contactName: form.contactName.trim() || null,
        cep: form.cep.trim() || null,
        street: form.street.trim() || null,
        number: form.number.trim() || null,
        complement: form.complement.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zone: form.zone,
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      };
      const res = await fetch(
        editing ? `/api/admin/gerencia/donatarias/${editing.id}` : "/api/admin/gerencia/donatarias",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = (await res.json()) as ApiResponse<{ donataria: DonatariaView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", editing ? "Donatária atualizada." : "Donatária cadastrada.");
      setFormOpen(false);
      void load();
    } catch {
      toast.push("error", "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function archive(d: DonatariaView) {
    if (!confirm(`Arquivar "${d.name}"?`)) return;
    const res = await fetch(`/api/admin/gerencia/donatarias/${d.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ archived: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao arquivar.");
      return;
    }
    toast.push("success", "Donatária arquivada.");
    void load();
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência"
        title="Donatárias"
        description="Entidades que recebem as doações. Quem doa é cadastrado em Doadoras e escolhido no termo."
        rightSlot={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova donatária
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Cadastradas" value={loading ? "—" : donatarias.length} icon={Building2} />
        <StatTile
          label="Ativas"
          value={loading ? "—" : donatarias.filter((d) => d.isActive).length}
          icon={Building2}
          accent="emerald"
        />
      </div>

      <SectionCard title="Lista" description="Cadastro e contato." variant="elevated">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              className="pl-9"
              placeholder="Buscar nome, documento, cidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Só ativas
          </label>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Contato</Th>
              <Th>Cidade</Th>
              <Th>Zona</Th>
              <Th>Doações</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <Td>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{d.document || "—"}</div>
                </Td>
                <Td>
                  <div className="text-sm">{d.contactName || "—"}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {[d.phone, d.email].filter(Boolean).join(" · ") || "—"}
                  </div>
                </Td>
                <Td>
                  {d.city && d.state ? `${d.city}/${d.state}` : d.city || d.state || "—"}
                </Td>
                <Td>{DONATARIA_ZONE_LABEL[d.zone] ?? d.zone}</Td>
                <Td>{d._count?.donations ?? 0}</Td>
                <Td>
                  <Badge tone={d.isActive ? "green" : "zinc"}>{d.isActive ? "Ativa" : "Inativa"}</Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(d)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void archive(d)}>
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
                    Nenhuma donatária encontrada.
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
        title={editing ? "Editar donatária" : "Nova donatária"}
      >
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Nome</span>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">CNPJ/CPF</span>
            <Input
              value={form.document}
              onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Contato</span>
            <Input
              value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">E-mail</span>
            <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Telefone</span>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">CEP</span>
            <Input value={form.cep} onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Rua</span>
            <Input value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Número</span>
            <Input value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Complemento</span>
            <Input
              value={form.complement}
              onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Bairro</span>
            <Input
              value={form.neighborhood}
              onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Cidade</span>
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">UF</span>
            <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-sm">Zona</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {DONATARIA_ZONES.map((z) => (
                <label key={z} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="zone"
                    checked={form.zone === z}
                    onChange={() => setForm((f) => ({ ...f, zone: z }))}
                  />
                  {DONATARIA_ZONE_LABEL[z]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Ativa
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
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </Modal>
    </PanelPageStack>
  );
}
