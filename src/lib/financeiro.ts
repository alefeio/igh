import type {
  FinancialEntryKind,
  FinancialExpenseNature,
  FinancialPaymentMethod,
  FinancialPaymentStatus,
} from "@/generated/prisma/client";
import type { FinancialAttachmentView } from "@/lib/financeiro-attachments";
import { formatCentsBRL } from "@/lib/employees";
import {
  computeDueUrgency,
  type FinancialDueUrgency,
} from "@/lib/financeiro-payment-shared";

export const FINANCIAL_ENTRY_KINDS: readonly FinancialEntryKind[] = ["ENTRADA", "SAIDA"] as const;

export const FINANCIAL_ENTRY_KIND_LABEL: Record<FinancialEntryKind, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
};

export const FINANCIAL_EXPENSE_NATURES: readonly FinancialExpenseNature[] = ["FIXA", "VARIAVEL"] as const;

export const FINANCIAL_EXPENSE_NATURE_LABEL: Record<FinancialExpenseNature, string> = {
  FIXA: "Fixa",
  VARIAVEL: "Variável",
};

export function displayExpenseNature(
  kind: FinancialEntryKind,
  nature: FinancialExpenseNature | null | undefined,
): string {
  if (kind !== "SAIDA") return "—";
  if (!nature) return "Sem classificação";
  return FINANCIAL_EXPENSE_NATURE_LABEL[nature];
}

export function resolveSaidaExpenseNature(
  kind: FinancialEntryKind,
  nature: FinancialExpenseNature | null | undefined,
): FinancialExpenseNature | null {
  if (kind !== "SAIDA") return null;
  return nature ?? "VARIAVEL";
}

export const FINANCIAL_PAYMENT_METHODS: readonly FinancialPaymentMethod[] = [
  "PIX",
  "DINHEIRO",
  "TRANSFERENCIA",
  "BOLETO",
  "CARTAO",
  "CHEQUE",
  "OUTRO",
] as const;

export const FINANCIAL_PAYMENT_METHOD_LABEL: Record<FinancialPaymentMethod, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  TRANSFERENCIA: "Transferência",
  BOLETO: "Boleto",
  CARTAO: "Cartão",
  CHEQUE: "Cheque",
  OUTRO: "Outro",
};

export const FINANCIAL_PAYMENT_STATUSES: readonly FinancialPaymentStatus[] = [
  "EM_ABERTO",
  "PAGO",
  "PENDENTE",
] as const;

export const FINANCIAL_PAYMENT_STATUS_LABEL: Record<FinancialPaymentStatus, string> = {
  EM_ABERTO: "Em aberto",
  PAGO: "Pago",
  PENDENTE: "Pendente",
};

export type FinancialEntryView = {
  id: string;
  kind: FinancialEntryKind;
  description: string;
  amountCents: number;
  /** Data de vencimento (YYYY-MM-DD). */
  entryDate: string;
  paymentStatus: FinancialPaymentStatus;
  paidAt: string | null;
  /** Urgência derivada do vencimento + status (não persistida). */
  dueUrgency: FinancialDueUrgency;
  categoryId: string | null;
  paymentMethod: FinancialPaymentMethod;
  poloId: string | null;
  responsibleUserId: string | null;
  responsibleName: string | null;
  invoiceNumber: string | null;
  supplier: string | null;
  notes: string | null;
  attachmentUrl: string | null;
  attachmentPublicId: string | null;
  attachmentFileName: string | null;
  attachments: FinancialAttachmentView[];
  expenseNature: FinancialExpenseNature | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; kind: FinancialEntryKind } | null;
  polo: { id: string; name: string } | null;
  responsibleUser: { id: string; name: string; email: string } | null;
  createdByUser: { id: string; name: string } | null;
};

export type FinancialCategoryView = {
  id: string;
  name: string;
  kind: FinancialEntryKind;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { entries: number };
};

export function responsibleLabel(entry: {
  responsibleName?: string | null;
  responsibleUser?: { name: string } | null;
}): string {
  return entry.responsibleUser?.name || entry.responsibleName?.trim() || "—";
}

export function formatEntryDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function paymentStatusBadgeTone(
  status: FinancialPaymentStatus,
  urgency: FinancialDueUrgency,
): "zinc" | "green" | "red" | "amber" | "blue" {
  if (status === "PAGO") return "green";
  if (status === "PENDENTE" || urgency === "overdue") return "red";
  if (urgency === "due_today") return "amber";
  if (urgency === "due_soon") return "blue";
  return "zinc";
}

export { computeDueUrgency, formatCentsBRL };
export type { FinancialDueUrgency, FinancialAttachmentView };
