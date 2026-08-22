/** Fórmulas financeiras em centavos. Não misturar entryDate com paidAt. */

export type FinKind = "ENTRADA" | "SAIDA";
export type FinStatus = "EM_ABERTO" | "PAGO" | "PENDENTE";

export type FinRow = {
  kind: FinKind;
  amountCents: number;
  entryDate: Date;
  paidAt: Date | null;
  paymentStatus: FinStatus;
  categoryId: string | null;
  poloId: string | null;
  expenseNature: "FIXA" | "VARIAVEL" | null;
  deletedAt: Date | null;
};

export function inRange(d: Date, from: Date, to: Date): boolean {
  return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
}

export function postedInPeriod(row: FinRow, from: Date, to: Date): boolean {
  if (row.deletedAt) return false;
  return inRange(row.entryDate, from, to);
}

export function paidInPeriod(row: FinRow, from: Date, to: Date): boolean {
  if (row.deletedAt) return false;
  if (row.paymentStatus !== "PAGO") return false;
  if (!row.paidAt) return false;
  return inRange(row.paidAt, from, to);
}

export function sumCents(rows: Array<{ amountCents: number }>): number {
  let n = 0;
  for (const r of rows) n += r.amountCents;
  return n;
}

export function netPaidMovementCents(paidIn: number, paidOut: number): number {
  return paidIn - paidOut;
}

export function isPaidWithoutPaidAt(row: Pick<FinRow, "paymentStatus" | "paidAt" | "deletedAt">): boolean {
  if (row.deletedAt) return false;
  return row.paymentStatus === "PAGO" && !row.paidAt;
}

export function isOpenPayableOrReceivable(status: FinStatus): boolean {
  return status === "EM_ABERTO" || status === "PENDENTE";
}

/** Vencido: PENDENTE ou EM_ABERTO com entryDate (vencimento) < asOf. */
export function isOverdue(row: Pick<FinRow, "paymentStatus" | "entryDate" | "deletedAt">, asOf: Date): boolean {
  if (row.deletedAt) return false;
  if (row.paymentStatus === "PAGO") return false;
  if (row.paymentStatus === "PENDENTE") return true;
  return row.entryDate.getTime() < asOf.getTime();
}

export function agingBucket(entryDate: Date, asOf: Date): "a_vencer" | "0_30" | "31_60" | "61_plus" {
  const days = Math.floor((asOf.getTime() - entryDate.getTime()) / 86400000);
  if (days < 0) return "a_vencer";
  if (days <= 30) return "0_30";
  if (days <= 60) return "31_60";
  return "61_plus";
}

export function groupSum(
  rows: Array<{ key: string; amountCents: number }>,
): Array<{ key: string; amountCents: number }> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.key, (m.get(r.key) ?? 0) + r.amountCents);
  return [...m.entries()].map(([key, amountCents]) => ({ key, amountCents }));
}

export function ymKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
