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
import type { DonorInstitutionView } from "@/lib/donor-institution-ui";

type FormState = {
  name: string;
  document: string;
  email: string;
  address: string;
  city: string;
  state: string;
  cep: string;
  phone: string;
  representativeName: string;
  representativeRole: string;
  representativeCpf: string;
  isActive: boolean;
  isDefault: boolean;
};

function emptyForm(): FormState {
  return {
    name: "",
    document: "",
    email: "",
    address: "",
    city: "",
    state: "",
    cep: "",
    phone: "",
    representativeName: "",
    representativeRole: "",
    representativeCpf: "",
    isActive: true,
    isDefault: false,
  };
}

function toForm(s: DonorInstitutionView): FormState {
  return {
    name: s.name ?? "",
    document: s.document ?? "",
    email: s.email ?? "",
    address: s.address ?? "",
    city: s.city ?? "",
    state: s.state ?? "",
    cep: s.cep ?? "",
    phone: s.phone ?? "",
    representativeName: s.representativeName ?? "",
    representativeRole: s.representativeRole ?? "",
    representativeCpf: s.representativeCpf ?? "",
    isActive: s.isActive,
    isDefault: s.isDefault,
  };
}

export default function ConfiguracoesDoadoraPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [institutions, setInstitutions] = useState<DonorInstitutionView[]>([]);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DonorInstitutionView | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gerencia/configuracoes-doadora", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ institutions: DonorInstitutionView[] }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar doadoras.");
        return;
      }
      setInstitutions(json.data.institutions ?? []);
    } catch {
      toast.push("error", "Falha ao carregar doadoras.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return institutions.filter((d) => {
      if (activeOnly && !d.isActive) return false;
      if (!q) return true;
      const hay = `${d.name ?? ""} ${d.document ?? ""} ${d.representativeName ?? ""} ${d.city ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [institutions, search, activeOnly]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm(), isDefault: institutions.length === 0 });
    setFormOpen(true);
  }

  function openEdit(d: DonorInstitutionView) {
    setEditing(d);
    setForm(toForm(d));
    setFormOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.push("error", "Informe o nome da instituição doadora.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        document: form.document.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        cep: form.cep.trim() || null,
        phone: form.phone.trim() || null,
        representativeName: form.representativeName.trim() || null,
        representativeRole: form.representativeRole.trim() || null,
        representativeCpf: form.representativeCpf.trim() || null,
        isActive: form.isActive,
        isDefault: form.isDefault,
      };
      const res = await fetch(
        editing
          ? `/api/admin/gerencia/configuracoes-doadora/${editing.id}`
          : "/api/admin/gerencia/configuracoes-doadora",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = (await res.json()) as ApiResponse<{ institution: DonorInstitutionView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar doadora.");
        return;
      }
      toast.push("success", editing ? "Doadora atualizada." : "Doadora cadastrada.");
      setFormOpen(false);
      void load();
    } catch {
      toast.push("error", "Falha ao salvar doadora.");
    } finally {
      setSaving(false);
    }
  }

  async function archive(d: DonorInstitutionView) {
    if (!confirm(`Arquivar a doadora "${d.name ?? "sem nome"}"? Ela deixa de aparecer nos novos termos.`)) {
      return;
    }
    const res = await fetch(`/api/admin/gerencia/configuracoes-doadora/${d.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ archived: boolean }>;
    if (!res.ok || !json.ok) {
      toast.push("error", !json.ok ? json.error.message : "Falha ao arquivar.");
      return;
    }
    toast.push("success", "Doadora arquivada.");
    void load();
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência · Doações"
        title="Instituições doadoras"
        description="Cadastre quem doa (IGH ou outra instituição). No termo de doação você escolhe a doadora e a donatária."
        rightSlot={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova doadora
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          label="Doadoras ativas"
          value={loading ? "—" : institutions.filter((i) => i.isActive).length}
          icon={Building2}
        />
        <StatTile
          label="Padrão nos termos"
          value={
            loading
              ? "—"
              : institutions.find((i) => i.isDefault)?.name ?? "Nenhuma"
          }
          icon={Building2}
          accent="sky"
        />
      </div>

      <SectionCard
        title="Cadastro de doadoras"
        description="A doadora padrão é sugerida ao criar um termo. Você pode trocar na hora de registrar a doação."
        variant="elevated"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, CNPJ, responsável…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Só ativas
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Instituição</Th>
                <Th>CNPJ</Th>
                <Th>Responsável</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <Td>
                    <div className="font-medium">{d.name || "—"}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {[d.city, d.state].filter(Boolean).join("/") || d.email || "—"}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{d.document || "—"}</Td>
                  <Td>
                    <div>{d.representativeName || "—"}</div>
                    {d.representativeRole ? (
                      <div className="text-xs text-[var(--text-muted)]">{d.representativeRole}</div>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {d.isDefault ? <Badge tone="blue">Padrão</Badge> : null}
                      <Badge tone={d.isActive ? "green" : "zinc"}>
                        {d.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
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
              {filtered.length === 0 ? (
                <tr>
                  <Td colSpan={5}>
                    <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                      Nenhuma doadora encontrada.
                    </p>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar doadora" : "Nova instituição doadora"}
      >
        <p className="mb-3 text-sm text-[var(--text-muted)]">
          Estes dados entram no PDF do termo (quem doa). A donatária (quem recebe) é escolhida na
          tela de Doações.
        </p>
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Nome da instituição doadora</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex.: Instituto Gustavo Hessel"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">CNPJ</span>
            <Input
              value={form.document}
              onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">E-mail de contato</span>
            <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Endereço completo</span>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Cidade</span>
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Estado</span>
            <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">CEP</span>
            <Input value={form.cep} onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Telefone</span>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Nome completo do responsável</span>
            <Input
              value={form.representativeName}
              onChange={(e) => setForm((f) => ({ ...f, representativeName: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Cargo do responsável</span>
            <Input
              value={form.representativeRole}
              onChange={(e) => setForm((f) => ({ ...f, representativeRole: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">CPF do responsável</span>
            <Input
              value={form.representativeCpf}
              onChange={(e) => setForm((f) => ({ ...f, representativeCpf: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            Usar como doadora padrão nos novos termos
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Ativa (aparece na lista ao criar termo)
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
