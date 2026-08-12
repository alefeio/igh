import "server-only";

import { formatCnpj, formatCpf, employeePositionText } from "@/lib/employees";
import type {
  Employee,
  FundingChannel,
  PaymentAgreement,
  PayrollLine,
  PayrollMonth,
} from "@/generated/prisma/client";

export function referenceMonthFromYm(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function ymFromReferenceMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function bankSummaryFromEmployee(e: {
  bankName: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  pixKey: string | null;
}): string | null {
  const parts = [
    e.bankName?.trim(),
    e.bankAgency?.trim() ? `Ag ${e.bankAgency.trim()}` : null,
    e.bankAccount?.trim() ? `Cc ${e.bankAccount.trim()}` : null,
    e.pixKey?.trim() ? `Pix ${e.pixKey.trim()}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function documentIdFromEmployee(e: {
  employmentType: string;
  meiCnpj: string | null;
  cpf: string;
}): string | null {
  if (e.meiCnpj) return formatCnpj(e.meiCnpj);
  if (e.cpf) return formatCpf(e.cpf);
  return null;
}

type EmpSnap = Pick<
  Employee,
  | "id"
  | "name"
  | "cpf"
  | "position"
  | "positionLabel"
  | "employmentType"
  | "meiCnpj"
  | "bankName"
  | "bankAgency"
  | "bankAccount"
  | "pixKey"
  | "fundingChannel"
  | "fundingContractRef"
  | "monthlyPayCents"
  | "offBooksPayCents"
  | "notes"
> & { paymentAgreement: Pick<PaymentAgreement, "name"> | null };

export function buildPayrollLineSnapshot(employee: EmpSnap, sortOrder: number) {
  return {
    employeeId: employee.id,
    employeeName: employee.name,
    positionLabel: employeePositionText(employee),
    employmentType: employee.employmentType,
    documentId: documentIdFromEmployee(employee),
    bankSummary: bankSummaryFromEmployee(employee),
    fundingChannel: employee.fundingChannel as FundingChannel,
    fundingContractRef: employee.fundingContractRef,
    paymentAgreementName: employee.paymentAgreement?.name ?? null,
    amountCents: employee.monthlyPayCents ?? 0,
    offBooksPayCents: employee.offBooksPayCents ?? 0,
    observation: employee.notes,
    sortOrder,
  };
}

export function serializePayrollLine(line: PayrollLine) {
  return {
    id: line.id,
    payrollMonthId: line.payrollMonthId,
    employeeId: line.employeeId,
    employeeName: line.employeeName,
    positionLabel: line.positionLabel,
    employmentType: line.employmentType,
    documentId: line.documentId,
    bankSummary: line.bankSummary,
    fundingChannel: line.fundingChannel,
    fundingContractRef: line.fundingContractRef,
    paymentAgreementName: line.paymentAgreementName,
    amountCents: line.amountCents,
    offBooksPayCents: line.offBooksPayCents,
    observation: line.observation,
    paymentStatus: line.paymentStatus,
    paidAt: line.paidAt?.toISOString() ?? null,
    financialEntryId: line.financialEntryId,
    sortOrder: line.sortOrder,
  };
}

export function payrollTotals(lines: Array<{ amountCents: number; offBooksPayCents: number; documentId: string | null }>) {
  const amountCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const offBooksPayCents = lines.reduce((s, l) => s + l.offBooksPayCents, 0);
  const withDocument = lines.filter((l) => Boolean(l.documentId?.trim())).length;
  return {
    collaborators: lines.length,
    withDocument,
    amountCents,
    offBooksPayCents,
    totalCents: amountCents + offBooksPayCents,
  };
}

export function serializePayrollMonth(
  month: PayrollMonth & { lines: PayrollLine[] },
) {
  const lines = month.lines.map(serializePayrollLine);
  return {
    id: month.id,
    referenceMonth: ymFromReferenceMonth(month.referenceMonth),
    status: month.status,
    responsibleName: month.responsibleName,
    notes: month.notes,
    createdAt: month.createdAt.toISOString(),
    updatedAt: month.updatedAt.toISOString(),
    totals: payrollTotals(month.lines),
    lines,
    staffLines: lines.filter((l) => l.employmentType !== "ESTAGIO"),
    internLines: lines.filter((l) => l.employmentType === "ESTAGIO"),
  };
}
