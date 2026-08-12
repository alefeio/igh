"use client";

import { UserCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DashboardHero, PanelPageStack, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import {
  COLABORADOR_UPLOAD_SIGNATURE,
  apimagesUploadHeaders,
  buildApimagesUploadFormData,
  parseApimagesUploadJson,
  readApiJson,
} from "@/lib/apimages-upload";
import { formatCpf } from "@/lib/employees";

type EmployeeProfile = {
  id: string;
  name: string;
  cpf: string;
  status: string;
  photoUrl: string | null;
  position: string;
  positionLabel: string;
  employmentType: string;
  email: string | null;
  phone: string | null;
  meiCnpj: string | null;
  meiCompanyName: string | null;
  bankName: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  bankAccountType: string | null;
  pixKeyType: string | null;
  pixKey: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

type FormState = {
  email: string;
  phone: string;
  meiCnpj: string;
  meiCompanyName: string;
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  bankAccountType: string;
  pixKeyType: string;
  pixKey: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

const selectClass =
  "w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm";

function toForm(e: EmployeeProfile): FormState {
  return {
    email: e.email ?? "",
    phone: e.phone ?? "",
    meiCnpj: e.meiCnpj ?? "",
    meiCompanyName: e.meiCompanyName ?? "",
    bankName: e.bankName ?? "",
    bankAgency: e.bankAgency ?? "",
    bankAccount: e.bankAccount ?? "",
    bankAccountType: e.bankAccountType ?? "",
    pixKeyType: e.pixKeyType ?? "",
    pixKey: e.pixKey ?? "",
    cep: e.cep ?? "",
    street: e.street ?? "",
    number: e.number ?? "",
    complement: e.complement ?? "",
    neighborhood: e.neighborhood ?? "",
    city: e.city ?? "",
    state: e.state ?? "",
  };
}

export default function ColaboradorDadosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/colaborador", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ employee: EmployeeProfile }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao carregar seus dados.");
        return;
      }
      setEmployee(json.data.employee);
      setForm(toForm(json.data.employee));
    } catch {
      toast.push("error", "Falha ao carregar seus dados.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/me/colaborador", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          meiCnpj: form.meiCnpj.trim() || null,
          meiCompanyName: form.meiCompanyName.trim() || null,
          bankName: form.bankName.trim() || null,
          bankAgency: form.bankAgency.trim() || null,
          bankAccount: form.bankAccount.trim() || null,
          bankAccountType: form.bankAccountType || null,
          pixKeyType: form.pixKeyType || null,
          pixKey: form.pixKey.trim() || null,
          cep: form.cep.trim() || null,
          street: form.street.trim() || null,
          number: form.number.trim() || null,
          complement: form.complement.trim() || null,
          neighborhood: form.neighborhood.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ employee: EmployeeProfile }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
        return;
      }
      setEmployee(json.data.employee);
      setForm(toForm(json.data.employee));
      toast.push("success", "Dados atualizados.");
    } catch {
      toast.push("error", "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const signRes = await fetch(COLABORADOR_UPLOAD_SIGNATURE, { method: "POST" });
      const signJson = await readApiJson<{ uploadUrl: string; apiKey: string }>(signRes);
      if (!signRes.ok || !signJson.ok) {
        toast.push("error", !signJson.ok ? signJson.error.message : "Falha ao preparar upload.");
        return;
      }
      const uploadRes = await fetch(signJson.data.uploadUrl, {
        method: "POST",
        headers: apimagesUploadHeaders(signJson.data.apiKey),
        body: buildApimagesUploadFormData(file),
      });
      const cloud = parseApimagesUploadJson(await uploadRes.json());
      if (!uploadRes.ok || !cloud.url) {
        toast.push("error", cloud.errorMessage ?? "Falha no upload.");
        return;
      }
      const patchRes = await fetch("/api/me/colaborador", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: cloud.url }),
      });
      const patchJson = (await patchRes.json()) as ApiResponse<{ employee: EmployeeProfile }>;
      if (!patchRes.ok || !patchJson.ok) {
        toast.push("error", !patchJson.ok ? patchJson.error.message : "Falha ao salvar a foto.");
        return;
      }
      setEmployee(patchJson.data.employee);
      toast.push("success", "Foto atualizada.");
    } catch {
      toast.push("error", "Falha ao enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <PanelPageStack>
      <DashboardHero
        eyebrow="Portal do colaborador"
        title="Meus dados"
        description="Atualize contato, endereço, dados bancários/MEI e a foto de perfil. Nome e CPF são geridos pela administração."
        rightSlot={
          <Button onClick={() => void save()} disabled={saving || loading || !form}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
        }
      />

      <SectionCard title="Foto" variant="elevated">
        <div className="flex flex-wrap items-center gap-4">
          {employee?.photoUrl ? (
            <img
              src={employee.photoUrl}
              alt="Foto de perfil"
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--igh-surface)] text-[var(--text-muted)]">
              <UserCircle className="h-10 w-10" />
            </div>
          )}
          <label className="inline-block">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading || loading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadPhoto(file);
              }}
            />
            <Button type="button" variant="secondary" disabled={uploading || loading}>
              {uploading ? "Enviando…" : "Trocar foto"}
            </Button>
          </label>
        </div>
      </SectionCard>

      {loading || !form || !employee ? (
        <SectionCard title="Cadastro" variant="elevated">
          <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Identificação" description="Somente leitura" variant="elevated">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Nome</span>
                <Input className="mt-1" value={employee.name} disabled />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">CPF</span>
                <Input className="mt-1" value={formatCpf(employee.cpf)} disabled />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Cargo</span>
                <Input className="mt-1" value={employee.positionLabel} disabled />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Contato" variant="elevated">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">E-mail</span>
                <Input
                  className="mt-1"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Telefone</span>
                <Input
                  className="mt-1"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Endereço" variant="elevated">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">CEP</span>
                <Input className="mt-1" value={form.cep} onChange={(e) => set("cep", e.target.value)} />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-[var(--text-muted)]">Rua</span>
                <Input
                  className="mt-1"
                  value={form.street}
                  onChange={(e) => set("street", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Número</span>
                <Input
                  className="mt-1"
                  value={form.number}
                  onChange={(e) => set("number", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Complemento</span>
                <Input
                  className="mt-1"
                  value={form.complement}
                  onChange={(e) => set("complement", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Bairro</span>
                <Input
                  className="mt-1"
                  value={form.neighborhood}
                  onChange={(e) => set("neighborhood", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Cidade</span>
                <Input className="mt-1" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">UF</span>
                <Input
                  className="mt-1"
                  value={form.state}
                  onChange={(e) => set("state", e.target.value.slice(0, 2).toUpperCase())}
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="MEI e recebimento" variant="elevated">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">CNPJ MEI</span>
                <Input
                  className="mt-1"
                  value={form.meiCnpj}
                  onChange={(e) => set("meiCnpj", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Razão social MEI</span>
                <Input
                  className="mt-1"
                  value={form.meiCompanyName}
                  onChange={(e) => set("meiCompanyName", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Banco</span>
                <Input
                  className="mt-1"
                  value={form.bankName}
                  onChange={(e) => set("bankName", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Agência</span>
                <Input
                  className="mt-1"
                  value={form.bankAgency}
                  onChange={(e) => set("bankAgency", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Conta</span>
                <Input
                  className="mt-1"
                  value={form.bankAccount}
                  onChange={(e) => set("bankAccount", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Tipo de conta</span>
                <select
                  className={`mt-1 ${selectClass}`}
                  value={form.bankAccountType}
                  onChange={(e) => set("bankAccountType", e.target.value)}
                >
                  <option value="">Não informado</option>
                  <option value="CORRENTE">Corrente</option>
                  <option value="POUPANCA">Poupança</option>
                  <option value="PAGAMENTO">Pagamento</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Tipo da chave PIX</span>
                <select
                  className={`mt-1 ${selectClass}`}
                  value={form.pixKeyType}
                  onChange={(e) => set("pixKeyType", e.target.value)}
                >
                  <option value="">Não informado</option>
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="TELEFONE">Telefone</option>
                  <option value="ALEATORIA">Aleatória</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Chave PIX</span>
                <Input
                  className="mt-1"
                  value={form.pixKey}
                  onChange={(e) => set("pixKey", e.target.value)}
                />
              </label>
            </div>
          </SectionCard>

          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </>
      )}
    </PanelPageStack>
  );
}
