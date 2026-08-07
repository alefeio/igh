import type {
  FinancialEntryKind,
  FinancialPaymentMethod,
} from "@/generated/prisma/client";
import { formatCentsBRL } from "@/lib/employees";

export const FINANCIAL_ENTRY_KINDS: readonly FinancialEntryKind[] = ["ENTRADA", "SAIDA"] as const;

export const FINANCIAL_ENTRY_KIND_LABEL: Record<FinancialEntryKind, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
};

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

export type FinancialEntryView = {
  id: string;
  kind: FinancialEntryKind;
  description: string;
  amountCents: number;
  entryDate: string;
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

export { formatCentsBRL };
