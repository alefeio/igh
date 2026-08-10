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
    city?: string | null;
    state?: string | null;
    street?: string | null;
    number?: string | null;
  };
  donatedAt?: Date | string | null;
  description?: string | null;
  amountCents?: number | null;
  items?: Array<{ name: string; quantity: number; unit: string }>;
};

export function buildDonationVariableMap(donation: DonationTemplateInput): Record<string, string> {
  const addr = [
    donation.donataria.street,
    donation.donataria.number,
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

  return {
    "donataria.nome": donation.donataria.name,
    "donataria.documento": donation.donataria.document?.trim() || "—",
    "donataria.contato": donation.donataria.contactName?.trim() || "—",
    "donataria.endereco": addr || "—",
    "doacao.data": dateBr(donation.donatedAt ?? new Date()),
    "doacao.descricao": donation.description?.trim() || "—",
    "doacao.valor": formatCentsBRL(donation.amountCents),
    "doacao.itens": itemsText,
    "instituto.nome": BRAND.legalName || BRAND.shortName || "Instituto",
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
  "{{donataria.nome}}",
  "{{donataria.documento}}",
  "{{donataria.contato}}",
  "{{donataria.endereco}}",
  "{{doacao.data}}",
  "{{doacao.descricao}}",
  "{{doacao.valor}}",
  "{{doacao.itens}}",
] as const;
