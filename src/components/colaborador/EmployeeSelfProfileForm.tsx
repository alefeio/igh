"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";
import {
  BANK_ACCOUNT_TYPE_LABEL,
  BANK_ACCOUNT_TYPES,
  PIX_KEY_TYPE_LABEL,
  PIX_KEY_TYPES,
  UNIFORM_SIZES,
  formatCpf,
} from "@/lib/employees";

type EmployeeProfile = {
  name: string;
  cpf: string;
  rg: string | null;
  rgIssuer: string | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  uniformSize: string | null;
  shoeSize: string | null;
  employmentType: string;
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
  name: string;
  cpf: string;
  rg: string;
  rgIssuer: string;
  birthDate: string;
  email: string;
  phone: string;
  uniformSize: string;
  shoeSize: string;
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
  "mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm";

function toForm(e: EmployeeProfile): FormState {
  return {
    name: e.name ?? "",
    cpf: formatCpf(e.cpf ?? ""),
    rg: e.rg ?? "",
    rgIssuer: e.rgIssuer ?? "",
    birthDate: e.birthDate ? e.birthDate.slice(0, 10) : "",
    email: e.email ?? "",
    phone: e.phone ?? "",
    uniformSize: e.uniformSize ?? "",
    shoeSize: e.shoeSize ?? "",
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

export function EmployeeSelfProfileForm() {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    if (!form.name.trim() || form.cpf.replace(/\D/g, "").length !== 11) {
      toast.push("error", "Informe nome e CPF válidos.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/colaborador", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          cpf: form.cpf,
          rg: form.rg.trim() || null,
          rgIssuer: form.rgIssuer.trim() || null,
          birthDate: form.birthDate.trim() || "",
          email: form.email.trim() || null,
          phone: form.phone.replace(/\D/g, "") || null,
          uniformSize: form.uniformSize || null,
          shoeSize: form.shoeSize.trim() || null,
          meiCnpj: form.meiCnpj.replace(/\D/g, "") || null,
          meiCompanyName: form.meiCompanyName.trim() || null,
          bankName: form.bankName.trim() || null,
          bankAgency: form.bankAgency.trim() || null,
          bankAccount: form.bankAccount.trim() || null,
          bankAccountType: form.bankAccountType || null,
          pixKeyType: form.pixKeyType || null,
          pixKey: form.pixKey.trim() || null,
          cep: form.cep.replace(/\D/g, "") || null,
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
      setForm(toForm(json.data.employee));
      toast.push("success", "Dados atualizados.");
      router.refresh();
    } catch {
      toast.push("error", "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Dados pessoais
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome completo *">
            <Input className="mt-1" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="CPF *">
            <Input
              className="mt-1"
              inputMode="numeric"
              value={form.cpf}
              onChange={(e) => set("cpf", formatCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="RG">
            <Input className="mt-1" value={form.rg} onChange={(e) => set("rg", e.target.value)} />
          </Field>
          <Field label="Órgão emissor">
            <Input className="mt-1" value={form.rgIssuer} onChange={(e) => set("rgIssuer", e.target.value)} />
          </Field>
          <Field label="Nascimento">
            <Input
              className="mt-1"
              type="date"
              value={form.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
            />
          </Field>
          <Field label="Telefone">
            <Input
              className="mt-1"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
            />
          </Field>
          <Field label="E-mail">
            <Input
              className="mt-1"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Tamanho do uniforme">
            <select
              className={selectClass}
              value={form.uniformSize}
              onChange={(e) => set("uniformSize", e.target.value)}
            >
              <option value="">Não informado</option>
              {UNIFORM_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Numeração do calçado">
            <Input
              className="mt-1"
              value={form.shoeSize}
              onChange={(e) => set("shoeSize", e.target.value)}
              placeholder="Ex.: 39"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">MEI</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CNPJ">
              <Input
                className="mt-1"
                inputMode="numeric"
                value={form.meiCnpj}
                onChange={(e) => set("meiCnpj", e.target.value.replace(/\D/g, "").slice(0, 14))}
              />
            </Field>
            <Field label="Nome fantasia / razão social">
              <Input
                className="mt-1"
                value={form.meiCompanyName}
                onChange={(e) => set("meiCompanyName", e.target.value)}
              />
            </Field>
          </div>
        </section>

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Conta bancária e Pix
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Banco">
            <Input className="mt-1" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
          </Field>
          <Field label="Agência">
            <Input className="mt-1" value={form.bankAgency} onChange={(e) => set("bankAgency", e.target.value)} />
          </Field>
          <Field label="Conta">
            <Input className="mt-1" value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} />
          </Field>
          <Field label="Tipo de conta">
            <select
              className={selectClass}
              value={form.bankAccountType}
              onChange={(e) => set("bankAccountType", e.target.value)}
            >
              <option value="">Não informado</option>
              {BANK_ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {BANK_ACCOUNT_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo da chave Pix">
            <select
              className={selectClass}
              value={form.pixKeyType}
              onChange={(e) => set("pixKeyType", e.target.value)}
            >
              <option value="">Não informado</option>
              {PIX_KEY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PIX_KEY_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Chave Pix">
            <Input className="mt-1" value={form.pixKey} onChange={(e) => set("pixKey", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Endereço</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CEP">
            <Input
              className="mt-1"
              inputMode="numeric"
              value={form.cep}
              onChange={(e) => set("cep", e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
          </Field>
          <Field label="UF">
            <Input
              className="mt-1"
              value={form.state}
              onChange={(e) => set("state", e.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
            />
          </Field>
          <Field label="Cidade">
            <Input className="mt-1" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Bairro">
            <Input
              className="mt-1"
              value={form.neighborhood}
              onChange={(e) => set("neighborhood", e.target.value)}
            />
          </Field>
          <Field label="Rua">
            <Input className="mt-1" value={form.street} onChange={(e) => set("street", e.target.value)} />
          </Field>
          <Field label="Número">
            <Input className="mt-1" value={form.number} onChange={(e) => set("number", e.target.value)} />
          </Field>
          <Field label="Complemento">
            <Input
              className="mt-1"
              value={form.complement}
              onChange={(e) => set("complement", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
