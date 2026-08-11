import "server-only";

import type { FinancialPaymentStatus } from "@/generated/prisma/client";
import {
  FINANCIAL_DUE_SOON_DAYS,
  computeDueUrgency,
  resolveInitialPaymentStatusFromIso,
  type FinancialDueUrgency,
} from "@/lib/financeiro-payment-shared";
import { prisma } from "@/lib/prisma";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

export { FINANCIAL_DUE_SOON_DAYS, computeDueUrgency };
export type { FinancialDueUrgency };

export function toDateOnlyUtc(isoOrDate: string | Date): Date {
  if (isoOrDate instanceof Date) {
    return new Date(Date.UTC(isoOrDate.getUTCFullYear(), isoOrDate.getUTCMonth(), isoOrDate.getUTCDate()));
  }
  const s = isoOrDate.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Resolve status inicial no cadastro:
 * - vencimento futuro ou hoje → EM_ABERTO
 * - vencimento passado → PAGO ou PENDENTE conforme o usuário informar
 */
export function resolveInitialPaymentStatus(input: {
  dueDate: Date;
  alreadyPaid?: boolean | null;
  today?: Date;
}): { paymentStatus: FinancialPaymentStatus; paidAt: Date | null } {
  const today = input.today ?? getBrazilTodayDateOnly();
  const due = toDateOnlyUtc(input.dueDate);
  const resolved = resolveInitialPaymentStatusFromIso({
    dueIso: due.toISOString().slice(0, 10),
    alreadyPaid: input.alreadyPaid,
    todayIso: today.toISOString().slice(0, 10),
  });
  return {
    paymentStatus: resolved.paymentStatus,
    paidAt: resolved.paymentStatus === "PAGO" ? today : null,
  };
}

/** Contas em aberto cujo vencimento já passou → Pendente. */
export async function syncOverdueFinancialEntries(today = getBrazilTodayDateOnly()): Promise<number> {
  const result = await prisma.financialEntry.updateMany({
    where: {
      deletedAt: null,
      paymentStatus: "EM_ABERTO",
      entryDate: { lt: today },
    },
    data: { paymentStatus: "PENDENTE" },
  });
  return result.count;
}

/** Notifica gerentes sobre contas vencendo (7 dias), que vencem hoje ou pendentes. */
export async function ensureFinancialDueReminders(today = getBrazilTodayDateOnly()): Promise<void> {
  const soonEnd = new Date(today);
  soonEnd.setUTCDate(soonEnd.getUTCDate() + FINANCIAL_DUE_SOON_DAYS);

  const [dueSoon, dueToday, overdue] = await Promise.all([
    prisma.financialEntry.findMany({
      where: {
        deletedAt: null,
        paymentStatus: "EM_ABERTO",
        entryDate: { gt: today, lte: soonEnd },
      },
      select: { id: true, description: true, entryDate: true, amountCents: true },
      take: 50,
      orderBy: { entryDate: "asc" },
    }),
    prisma.financialEntry.findMany({
      where: {
        deletedAt: null,
        paymentStatus: { in: ["EM_ABERTO", "PENDENTE"] },
        entryDate: today,
      },
      select: { id: true, description: true, entryDate: true, amountCents: true },
      take: 50,
      orderBy: { description: "asc" },
    }),
    prisma.financialEntry.findMany({
      where: {
        deletedAt: null,
        paymentStatus: "PENDENTE",
        entryDate: { lt: today },
      },
      select: { id: true, description: true, entryDate: true, amountCents: true },
      take: 50,
      orderBy: { entryDate: "asc" },
    }),
  ]);

  if (dueSoon.length === 0 && dueToday.length === 0 && overdue.length === 0) return;

  const managers = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ role: { in: ["ADMIN_MANAGER", "MASTER", "GENERAL_ADMIN"] } }, { isAdminManager: true }],
    },
    select: { id: true },
  });
  if (managers.length === 0) return;

  const dayKey = today.toISOString().slice(0, 10);
  const linkUrl = "/admin/gerencia/financeiro";

  const notifyAll = async (dedupeSuffix: string, title: string, body: string) => {
    await Promise.all(
      managers.map((m) =>
        createUserNotificationIfNew({
          userId: m.id,
          kind: "FINANCIAL_DUE_REMINDER",
          title,
          body,
          linkUrl,
          dedupeKey: `fin_due:${dayKey}:${dedupeSuffix}:${m.id}`,
        }),
      ),
    );
  };

  if (dueToday.length > 0) {
    const names = dueToday
      .slice(0, 3)
      .map((e) => e.description)
      .join(", ");
    const extra = dueToday.length > 3 ? ` e mais ${dueToday.length - 3}` : "";
    await notifyAll(
      "today",
      "Contas vencem hoje",
      `${dueToday.length} conta(s) vencem hoje (${names}${extra}). Marque como paga após o pagamento; amanhã passará a Pendente automaticamente.`,
    );
  }

  if (dueSoon.length > 0) {
    await notifyAll(
      "soon",
      "Contas a vencer",
      `${dueSoon.length} conta(s) vencem nos próximos ${FINANCIAL_DUE_SOON_DAYS} dias. Abra o Financeiro para priorizar.`,
    );
  }

  if (overdue.length > 0) {
    await notifyAll(
      "overdue",
      "Contas pendentes",
      `${overdue.length} conta(s) vencida(s) ainda não marcadas como pagas.`,
    );
  }
}

export async function syncFinancialPaymentLifecycle(): Promise<{
  markedPending: number;
}> {
  const markedPending = await syncOverdueFinancialEntries();
  await ensureFinancialDueReminders();
  return { markedPending };
}
