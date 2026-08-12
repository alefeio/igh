"use client";

import { Building2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
};

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
  };
}

export default function ConfiguracoesDoadoraPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(toForm({
    id: "",
    name: null,
    document: null,
    email: null,
    address: null,
    city: null,
    state: null,
    cep: null,
    phone: null,
    representativeName: null,
    representativeRole: null,
    representativeCpf: null,
    updatedAt: "",
  }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gerencia/configuracoes-doadora", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ settings: DonorInstitutionView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar configurações.");
        return;
      }
      setForm(toForm(json.data.settings));
    } catch {
      toast.push("error", "Falha ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/gerencia/configuracoes-doadora", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim() || null,
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
        }),
      });
      const json = (await res.json()) as ApiResponse<{ settings: DonorInstitutionView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
        return;
      }
      setForm(toForm(json.data.settings));
      toast.push("success", "Configurações da doadora salvas.");
    } catch {
      toast.push("error", "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Gerência · Doações"
        title="Configurações da instituição doadora"
        description="Dados do instituto usados no PDF do termo de doação."
        rightSlot={
          <Button onClick={() => void save()} disabled={saving || loading}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        }
      />

      <SectionCard
        title="Instituição doadora"
        description="Preencha como deve aparecer no PDF do termo."
        variant="elevated"
      >
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Building2 className="h-4 w-4" />
          {loading ? "Carregando…" : "Um único cadastro para todo o instituto."}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm">Nome da Instituição Doadora</span>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
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
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void save()} disabled={saving || loading}>
            {saving ? "Salvando…" : "Salvar configurações"}
          </Button>
        </div>
      </SectionCard>
    </PanelPageStack>
  );
}
