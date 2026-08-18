import "server-only";

import type { Employee } from "@/generated/prisma/client";
import { employeePositionText, formatCentsBRL, formatCpf } from "@/lib/employees";
import { BRAND } from "@/lib/brand";

export type ContractTemplateVars = {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  monthlyValueCents?: number | null;
  issuedAt?: Date | string | null;
};

function dateBr(value: Date | string | null | undefined): string {
  if (!value) return "____/____/________";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "____/____/________";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function addressLine(e: Employee): string {
  const parts = [
    e.street,
    e.number,
    e.complement,
    e.neighborhood,
    e.city && e.state ? `${e.city}/${e.state}` : e.city || e.state,
    e.cep,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

/** Mapa de variáveis disponíveis nos modelos oficiais. */
export function buildDocumentVariableMap(
  employee: Employee,
  contract?: ContractTemplateVars,
): Record<string, string> {
  return {
    "funcionario.nome": employee.name,
    "funcionario.cpf": formatCpf(employee.cpf),
    "funcionario.rg": employee.rg?.trim() || "—",
    "funcionario.cargo": employeePositionText(employee),
    "funcionario.email": employee.email?.trim() || "—",
    "funcionario.telefone": employee.phone?.trim() || "—",
    "funcionario.endereco": addressLine(employee),
    "funcionario.mei_cnpj": employee.meiCnpj?.trim() || "—",
    "funcionario.pix": employee.pixKey?.trim() || "—",
    "funcionario.banco": employee.bankName?.trim() || "—",
    "funcionario.agencia": employee.bankAgency?.trim() || "—",
    "funcionario.conta": employee.bankAccount?.trim() || "—",
    "contrato.valor": formatCentsBRL(contract?.monthlyValueCents),
    "contrato.inicio": dateBr(contract?.startDate),
    "contrato.fim": dateBr(contract?.endDate),
    "contrato.data": dateBr(contract?.issuedAt ?? new Date()),
    "instituto.nome": BRAND.legalName || BRAND.shortName || "Instituto",
  };
}

export type DonationTemplateInput = {
  donataria: {
    name: string;
    document?: string | null;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    street?: string | null;
    number?: string | null;
    cep?: string | null;
    zone?: string | null;
  };
  donatedAt?: Date | string | null;
  description?: string | null;
  amountCents?: number | null;
  kitsCount?: number | null;
  belongsTo?: string | null;
  placeDateText?: string | null;
  termNumber?: number | null;
  items?: Array<{ name: string; quantity: number; unit: string }>;
  /** Dados da doadora (sobrescrevem BRAND nos placeholders instituto.*). */
  donorInstitution?: Record<string, string> | null;
};

export function buildDonationVariableMap(donation: DonationTemplateInput): Record<string, string> {
  const addr = [
    donation.donataria.street,
    donation.donataria.number,
    donation.donataria.cep,
    donation.donataria.city && donation.donataria.state
      ? `${donation.donataria.city}/${donation.donataria.state}`
      : donation.donataria.city || donation.donataria.state,
  ]
    .filter(Boolean)
    .join(", ");
  const itemsText =
    donation.items && donation.items.length > 0
      ? donation.items.map((i) => `${i.quantity} ${i.unit} — ${i.name}`).join("; ")
      : "—";
  const itemsLines =
    donation.items && donation.items.length > 0
      ? donation.items.map((i) => `${i.name}: ${String(i.quantity).padStart(2, "0")}`).join("\n")
      : "—";
  const zone =
    donation.donataria.zone === "RURAL"
      ? "Rural"
      : donation.donataria.zone === "URBANA"
        ? "Urbana"
        : donation.donataria.zone?.trim() || "—";

  return {
    "donataria.nome": donation.donataria.name,
    "donataria.documento": donation.donataria.document?.trim() || "—",
    "donataria.contato": donation.donataria.contactName?.trim() || "—",
    "donataria.telefone": donation.donataria.phone?.trim() || "—",
    "donataria.email": donation.donataria.email?.trim() || "—",
    "donataria.endereco": addr || "—",
    "donataria.cidade": donation.donataria.city?.trim() || "—",
    "donataria.estado": donation.donataria.state?.trim() || "—",
    "donataria.cep": donation.donataria.cep?.trim() || "—",
    "donataria.zona": zone,
    "doacao.data": dateBr(donation.donatedAt ?? new Date()),
    "doacao.descricao": donation.description?.trim() || "—",
    "doacao.valor": formatCentsBRL(donation.amountCents),
    "doacao.itens": itemsText,
    "doacao.itens_lista": itemsLines,
    "doacao.kits": donation.kitsCount && donation.kitsCount > 0 ? String(donation.kitsCount) : "—",
    "doacao.numero": donation.termNumber != null ? String(donation.termNumber) : "—",
    "doacao.pertence_a": donation.belongsTo?.trim() || "—",
    "doacao.local_data": donation.placeDateText?.trim() || "—",
    "instituto.nome": BRAND.legalName || BRAND.shortName || "Instituto",
    ...(donation.donorInstitution ?? {}),
  };
}

/** Substitui `{{chave}}` no HTML do modelo. */
export function renderDocumentTemplateHtml(
  contentRich: string,
  vars: Record<string, string>,
): string {
  return contentRich.replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}/gi, (_full, key: string) => {
    const value = vars[key.toLowerCase()];
    return value != null ? escapeHtml(value) : `{{${key}}}`;
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const DOCUMENT_TEMPLATE_VARIABLE_HELP = [
  "{{funcionario.nome}}",
  "{{funcionario.cpf}}",
  "{{funcionario.rg}}",
  "{{funcionario.cargo}}",
  "{{funcionario.email}}",
  "{{funcionario.telefone}}",
  "{{funcionario.endereco}}",
  "{{funcionario.mei_cnpj}}",
  "{{funcionario.pix}}",
  "{{funcionario.banco}}",
  "{{funcionario.agencia}}",
  "{{funcionario.conta}}",
  "{{contrato.valor}}",
  "{{contrato.inicio}}",
  "{{contrato.fim}}",
  "{{contrato.data}}",
  "{{instituto.nome}}",
  "{{instituto.cnpj}}",
  "{{instituto.email}}",
  "{{instituto.endereco}}",
  "{{instituto.cidade}}",
  "{{instituto.estado}}",
  "{{instituto.cep}}",
  "{{instituto.telefone}}",
  "{{instituto.responsavel}}",
  "{{instituto.cargo}}",
  "{{instituto.cpf}}",
  "{{doadora.nome}}",
  "{{doadora.cnpj}}",
  "{{doadora.email}}",
  "{{doadora.endereco}}",
  "{{doadora.cidade}}",
  "{{doadora.estado}}",
  "{{doadora.cep}}",
  "{{doadora.telefone}}",
  "{{doadora.responsavel}}",
  "{{doadora.cargo}}",
  "{{doadora.cpf}}",
  "{{donataria.nome}}",
  "{{donataria.documento}}",
  "{{donataria.contato}}",
  "{{donataria.telefone}}",
  "{{donataria.email}}",
  "{{donataria.endereco}}",
  "{{donataria.cidade}}",
  "{{donataria.estado}}",
  "{{donataria.cep}}",
  "{{donataria.zona}}",
  "{{doacao.data}}",
  "{{doacao.descricao}}",
  "{{doacao.valor}}",
  "{{doacao.itens}}",
  "{{doacao.itens_lista}}",
  "{{doacao.kits}}",
  "{{doacao.numero}}",
  "{{doacao.pertence_a}}",
  "{{doacao.local_data}}",
] as const;
