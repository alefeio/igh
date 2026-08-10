"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { ApiResponse } from "@/lib/api-types";
import {
  BANK_ACCOUNT_TYPE_LABEL,
  BANK_ACCOUNT_TYPES,
  EMPLOYEE_POSITION_LABEL,
  EMPLOYEE_POSITIONS,
  EMPLOYEE_STATUS_LABEL,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPE_LABEL,
  EMPLOYMENT_TYPES,
  FUNDING_CHANNEL_LABEL,
  FUNDING_CHANNELS,
  PIX_KEY_TYPE_LABEL,
  PIX_KEY_TYPES,
  UNIFORM_SIZES,
  formatCpf,
  type EmployeeView,
} from "@/lib/employees";
import type {
  BankAccountType,
  EmployeePosition,
  EmployeeStatus,
  EmploymentType,
  FundingChannel,
  PixKeyType,
  UniformSize,
} from "@/generated/prisma/client";

export type LinkableUser = { id: string; name: string; email: string; role: string };
export type PoloOption = { id: string; name: string };

type FormState = {
  userId: string;
  name: string;
  cpf: string;
  rg: string;
  rgIssuer: string;
  birthDate: string;
  email: string;
  phone: string;
  position: EmployeePosition;
  positionLabel: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  admissionDate: string;
  terminationDate: string;
  monthlyPay: string;
  fundingChannel: FundingChannel;
  fundingContractRef: string;
  offBooksPay: string;
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
  notes: string;
  poloId: string;
};

function emptyForm(): FormState {
  return {
    userId: "",
    name: "",
    cpf: "",
    rg: "",
    rgIssuer: "",
    birthDate: "",
    email: "",
    phone: "",
    position: "ADMINISTRATIVO",
    positionLabel: "",
    employmentType: "MEI",
    status: "ATIVO",
    admissionDate: "",
    terminationDate: "",
    monthlyPay: "",
    fundingChannel: "CONVENIO",
    fundingContractRef: "",
    offBooksPay: "",
    uniformSize: "",
  shoeSize: "",
  meiCnpj: "",
    meiCompanyName: "",
    bankName: "",
    bankAgency: "",
    bankAccount: "",
    bankAccountType: "",
    pixKeyType: "",
    pixKey: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    notes: "",
    poloId: "",
  };
}

function fromEmployee(e: EmployeeView): FormState {
  return {
    userId: e.userId ?? "",
    name: e.name,
    cpf: formatCpf(e.cpf),
    rg: e.rg ?? "",
    rgIssuer: e.rgIssuer ?? "",
    birthDate: e.birthDate ?? "",
    email: e.email ?? "",
    phone: e.phone ?? "",
    position: e.position,
    positionLabel: e.positionLabel ?? "",
    employmentType: e.employmentType,
    status: e.status,
    admissionDate: e.admissionDate ?? "",
    terminationDate: e.terminationDate ?? "",
    monthlyPay:
      e.monthlyPayCents == null ? "" : (e.monthlyPayCents / 100).toFixed(2).replace(".", ","),
    fundingChannel: e.fundingChannel ?? "CONVENIO",
    fundingContractRef: e.fundingContractRef ?? "",
    offBooksPay:
      e.offBooksPayCents == null ? "" : (e.offBooksPayCents / 100).toFixed(2).replace(".", ","),
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
    notes: e.notes ?? "",
    poloId: e.poloId ?? "",
  };
}

function centsFromPay(raw: string): string | undefined {
  const t = raw.trim();
  return t === "" ? undefined : t;
}

function payloadFromForm(form: FormState) {
  return {
    userId: form.userId || null,
    name: form.name.trim(),
    cpf: form.cpf,
    rg: form.rg,
    rgIssuer: form.rgIssuer,
    birthDate: form.birthDate,
    email: form.email,
    phone: form.phone,
    position: form.position,
    positionLabel: form.positionLabel,
    employmentType: form.employmentType,
    status: form.status,
    admissionDate: form.admissionDate,
    terminationDate: form.terminationDate,
    monthlyPay: centsFromPay(form.monthlyPay),
    fundingChannel: form.fundingChannel,
    fundingContractRef: form.fundingContractRef,
    offBooksPay: centsFromPay(form.offBooksPay),
    uniformSize: (form.uniformSize || null) as UniformSize | null,
    shoeSize: form.shoeSize,
    meiCnpj: form.meiCnpj,
    meiCompanyName: form.meiCompanyName,
    bankName: form.bankName,
    bankAgency: form.bankAgency,
    bankAccount: form.bankAccount,
    bankAccountType: (form.bankAccountType || null) as BankAccountType | null,
    pixKeyType: (form.pixKeyType || null) as PixKeyType | null,
    pixKey: form.pixKey,
    cep: form.cep,
    street: form.street,
    number: form.number,
    complement: form.complement,
    neighborhood: form.neighborhood,
    city: form.city,
    state: form.state,
    notes: form.notes,
    poloId: form.poloId || null,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const selectClass =
  "w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text-primary)]";

type Props = {
  open: boolean;
  editing: EmployeeView | null;
  users: LinkableUser[];
  polos: PoloOption[];
  onClose: () => void;
  onSaved: (employee: EmployeeView) => void;
};

export function EmployeeFormModal({ open, editing, users, polos, onClose, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? fromEmployee(editing) : emptyForm());
  }, [open, editing]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === form.userId) ?? null,
    [users, form.userId],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onUserLink(userId: string) {
    const user = users.find((u) => u.id === userId);
    setForm((prev) => ({
      ...prev,
      userId,
      name: prev.name.trim() ? prev.name : (user?.name ?? prev.name),
      email: prev.email.trim() ? prev.email : (user?.email ?? prev.email),
    }));
  }

  async function save() {
    if (!form.name.trim() || form.cpf.replace(/\D/g, "").length !== 11) {
      toast.push("error", "Informe nome e CPF válidos.");
      return;
    }
    if (form.status === "DESLIGADO" && !form.terminationDate) {
      toast.push("error", "Informe a data de desligamento.");
      return;
    }

    setSaving(true);
    try {
      const body = payloadFromForm(form);
      const res = await fetch(
        editing
          ? `/api/admin/gerencia/colaboradores/${editing.id}`
          : "/api/admin/gerencia/colaboradores",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json()) as ApiResponse<{ employee: EmployeeView }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
        return;
      }
      onSaved(json.data.employee);
      toast.push("success", editing ? "Colaborador atualizado." : "Colaborador cadastrado.");
      onClose();
    } catch {
      toast.push("error", "Falha ao salvar colaborador.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar colaborador" : "Novo colaborador"}
      size="large"
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Vínculo com o sistema
          </h3>
          <Field label="Conta existente (opcional)">
            <select
              className={selectClass}
              value={form.userId}
              onChange={(e) => onUserLink(e.target.value)}
            >
              <option value="">Sem vínculo — só ficha administrativa</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.email}
                </option>
              ))}
            </select>
          </Field>
          {selectedUser ? (
            <p className="text-xs text-[var(--text-muted)]">
              Vinculado a {selectedUser.name} ({selectedUser.role}).
            </p>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Dados pessoais
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome completo *">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="CPF *">
              <Input
                inputMode="numeric"
                value={form.cpf}
                onChange={(e) => set("cpf", formatCpf(e.target.value))}
                placeholder="000.000.000-00"
              />
            </Field>
            <Field label="RG">
              <Input value={form.rg} onChange={(e) => set("rg", e.target.value)} />
            </Field>
            <Field label="Órgão emissor">
              <Input value={form.rgIssuer} onChange={(e) => set("rgIssuer", e.target.value)} />
            </Field>
            <Field label="Nascimento">
              <Input
                type="date"
                value={form.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </Field>
            <Field label="Telefone">
              <Input
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
              />
            </Field>
            <Field label="E-mail">
              <Input
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
                {UNIFORM_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Numeração do calçado">
              <Input
                value={form.shoeSize}
                onChange={(e) => set("shoeSize", e.target.value)}
                placeholder="Ex.: 39"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Vínculo profissional
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cargo *">
              <select
                className={selectClass}
                value={form.position}
                onChange={(e) => set("position", e.target.value as EmployeePosition)}
              >
                {EMPLOYEE_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {EMPLOYEE_POSITION_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cargo (detalhe)">
              <Input
                value={form.positionLabel}
                onChange={(e) => set("positionLabel", e.target.value)}
                placeholder="Ex.: Auxiliar de secretaria"
              />
            </Field>
            <Field label="Tipo de vínculo">
              <select
                className={selectClass}
                value={form.employmentType}
                onChange={(e) => set("employmentType", e.target.value as EmploymentType)}
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EMPLOYMENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={selectClass}
                value={form.status}
                onChange={(e) => set("status", e.target.value as EmployeeStatus)}
              >
                {EMPLOYEE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {EMPLOYEE_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Admissão">
              <Input
                type="date"
                value={form.admissionDate}
                onChange={(e) => set("admissionDate", e.target.value)}
              />
            </Field>
            <Field label="Desligamento">
              <Input
                type="date"
                value={form.terminationDate}
                onChange={(e) => set("terminationDate", e.target.value)}
              />
            </Field>
            <Field label="Remuneração mensal (R$)">
              <Input
                inputMode="decimal"
                value={form.monthlyPay}
                onChange={(e) => set("monthlyPay", e.target.value)}
                placeholder="0,00"
              />
            </Field>
            <Field label="Canal de recurso">
              <select
                className={selectClass}
                value={form.fundingChannel}
                onChange={(e) => set("fundingChannel", e.target.value as FundingChannel)}
              >
                {FUNDING_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {FUNDING_CHANNEL_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Referência do contrato / fonte">
              <Input
                value={form.fundingContractRef}
                onChange={(e) => set("fundingContractRef", e.target.value)}
                placeholder="Ex.: 971744 - IGH CONVÊNIO"
              />
            </Field>
            <Field label="Valores por fora (R$)">
              <Input
                inputMode="decimal"
                value={form.offBooksPay}
                onChange={(e) => set("offBooksPay", e.target.value)}
                placeholder="0,00"
              />
            </Field>
            <Field label="Polo">
              <select
                className={selectClass}
                value={form.poloId}
                onChange={(e) => set("poloId", e.target.value)}
              >
                <option value="">Sem polo</option>
                {polos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        {form.employmentType === "MEI" ? (
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              MEI
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="CNPJ">
                <Input
                  inputMode="numeric"
                  value={form.meiCnpj}
                  onChange={(e) => set("meiCnpj", e.target.value.replace(/\D/g, "").slice(0, 14))}
                />
              </Field>
              <Field label="Nome fantasia / razão social">
                <Input
                  value={form.meiCompanyName}
                  onChange={(e) => set("meiCompanyName", e.target.value)}
                />
              </Field>
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Conta bancária e Pix
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Banco">
              <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
            </Field>
            <Field label="Agência">
              <Input value={form.bankAgency} onChange={(e) => set("bankAgency", e.target.value)} />
            </Field>
            <Field label="Conta">
              <Input
                value={form.bankAccount}
                onChange={(e) => set("bankAccount", e.target.value)}
              />
            </Field>
            <Field label="Tipo de conta">
              <select
                className={selectClass}
                value={form.bankAccountType}
                onChange={(e) => set("bankAccountType", e.target.value)}
              >
                <option value="">Não informado</option>
                {BANK_ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {BANK_ACCOUNT_TYPE_LABEL[t]}
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
                {PIX_KEY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PIX_KEY_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Chave Pix">
              <Input value={form.pixKey} onChange={(e) => set("pixKey", e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Endereço
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CEP">
              <Input
                inputMode="numeric"
                value={form.cep}
                onChange={(e) => set("cep", e.target.value.replace(/\D/g, "").slice(0, 8))}
              />
            </Field>
            <Field label="UF">
              <Input
                value={form.state}
                onChange={(e) => set("state", e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
              />
            </Field>
            <Field label="Cidade">
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Bairro">
              <Input
                value={form.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)}
              />
            </Field>
            <Field label="Rua">
              <Input value={form.street} onChange={(e) => set("street", e.target.value)} />
            </Field>
            <Field label="Número">
              <Input value={form.number} onChange={(e) => set("number", e.target.value)} />
            </Field>
            <Field label="Complemento">
              <Input
                value={form.complement}
                onChange={(e) => set("complement", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <Field label="Observações">
          <textarea
            className="min-h-24 w-full rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--card-border)] pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
