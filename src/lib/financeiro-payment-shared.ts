/** Helpers de vencimento/status sem I/O — usáveis no client e no server. */

export type FinancialDueUrgency = "ok" | "due_soon" | "due_today" | "overdue";

export const FINANCIAL_DUE_SOON_DAYS = 7;

export function brazilTodayIsoDate(): string {
  const BRAZIL_UTC_OFFSET_HOURS = 3;
  const now = new Date();
  const brazil = new Date(now.getTime() - BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const y = brazil.getUTCFullYear();
  const m = String(brazil.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brazil.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysUntilDueIso(dueIso: string, todayIso = brazilTodayIsoDate()): number {
  const due = Date.parse(`${dueIso.slice(0, 10)}T00:00:00.000Z`);
  const today = Date.parse(`${todayIso}T00:00:00.000Z`);
  return Math.round((due - today) / 86_400_000);
}

export function computeDueUrgency(
  paymentStatus: "EM_ABERTO" | "PAGO" | "PENDENTE",
  dueDateIso: string,
  todayIso = brazilTodayIsoDate(),
): FinancialDueUrgency {
  if (paymentStatus === "PAGO") return "ok";
  const days = daysUntilDueIso(dueDateIso, todayIso);
  if (days < 0) return "overdue";
  if (days === 0) return "due_today";
  if (days <= FINANCIAL_DUE_SOON_DAYS) return "due_soon";
  return "ok";
}

export function isPastDueDate(dueIso: string, todayIso = brazilTodayIsoDate()): boolean {
  return daysUntilDueIso(dueIso, todayIso) < 0;
}

export function resolveInitialPaymentStatusFromIso(input: {
  dueIso: string;
  alreadyPaid?: boolean | null;
  todayIso?: string;
}): { paymentStatus: "EM_ABERTO" | "PAGO" | "PENDENTE" } {
  const todayIso = input.todayIso ?? brazilTodayIsoDate();
  if (daysUntilDueIso(input.dueIso, todayIso) >= 0) {
    return { paymentStatus: "EM_ABERTO" };
  }
  if (input.alreadyPaid === true) return { paymentStatus: "PAGO" };
  return { paymentStatus: "PENDENTE" };
}
