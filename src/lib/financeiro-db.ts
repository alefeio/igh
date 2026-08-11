import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { FinancialEntryView } from "@/lib/financeiro";
import { computeDueUrgency, FINANCIAL_DUE_SOON_DAYS } from "@/lib/financeiro-payment-shared";
import { prisma } from "@/lib/prisma";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import type { FinancialListQuery } from "@/lib/validators/financeiro";

export const financialEntryInclude = {
  category: { select: { id: true, name: true, kind: true } },
  polo: { select: { id: true, name: true } },
  responsibleUser: { select: { id: true, name: true, email: true } },
  createdByUser: { select: { id: true, name: true } },
} satisfies Prisma.FinancialEntryInclude;

type EntryRow = Prisma.FinancialEntryGetPayload<{ include: typeof financialEntryInclude }>;

export function serializeFinancialEntry(row: EntryRow): FinancialEntryView {
  const entryDate = row.entryDate.toISOString().slice(0, 10);
  return {
    id: row.id,
    kind: row.kind,
    description: row.description,
    amountCents: row.amountCents,
    entryDate,
    paymentStatus: row.paymentStatus,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    dueUrgency: computeDueUrgency(row.paymentStatus, entryDate),
    categoryId: row.categoryId,
    paymentMethod: row.paymentMethod,
    poloId: row.poloId,
    responsibleUserId: row.responsibleUserId,
    responsibleName: row.responsibleName,
    invoiceNumber: row.invoiceNumber,
    supplier: row.supplier,
    notes: row.notes,
    attachmentUrl: row.attachmentUrl,
    attachmentPublicId: row.attachmentPublicId,
    attachmentFileName: row.attachmentFileName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    category: row.category,
    polo: row.polo,
    responsibleUser: row.responsibleUser,
    createdByUser: row.createdByUser,
  };
}

export function financialEntryWhere(query: FinancialListQuery): Prisma.FinancialEntryWhereInput {
  const and: Prisma.FinancialEntryWhereInput[] = [{ deletedAt: null }];
  if (query.kind) and.push({ kind: query.kind });
  if (query.categoryId) and.push({ categoryId: query.categoryId });
  if (query.poloId) and.push({ poloId: query.poloId });
  if (query.paymentStatus) and.push({ paymentStatus: query.paymentStatus });
  if (query.dateFrom || query.dateTo) {
    and.push({
      entryDate: {
        ...(query.dateFrom ? { gte: query.dateFrom } : {}),
        ...(query.dateTo ? { lte: query.dateTo } : {}),
      },
    });
  }

  if (query.dueAlert) {
    const today = getBrazilTodayDateOnly();
    const soonEnd = new Date(today);
    soonEnd.setUTCDate(soonEnd.getUTCDate() + FINANCIAL_DUE_SOON_DAYS);

    if (query.dueAlert === "today") {
      and.push({
        paymentStatus: { in: ["EM_ABERTO", "PENDENTE"] },
        entryDate: today,
      });
    } else if (query.dueAlert === "soon") {
      and.push({
        paymentStatus: "EM_ABERTO",
        entryDate: { gt: today, lte: soonEnd },
      });
    } else if (query.dueAlert === "overdue") {
      and.push({
        paymentStatus: "PENDENTE",
        entryDate: { lt: today },
      });
    } else if (query.dueAlert === "attention") {
      and.push({
        OR: [
          { paymentStatus: "EM_ABERTO", entryDate: { gte: today, lte: soonEnd } },
          { paymentStatus: "PENDENTE" },
        ],
      });
    }
  }

  if (query.q) {
    and.push({
      OR: [
        { description: { contains: query.q, mode: "insensitive" } },
        { supplier: { contains: query.q, mode: "insensitive" } },
        { invoiceNumber: { contains: query.q, mode: "insensitive" } },
        { responsibleName: { contains: query.q, mode: "insensitive" } },
        { notes: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: and };
}

export async function sumFinancialTotals(where: Prisma.FinancialEntryWhereInput) {
  const groups = await prisma.financialEntry.groupBy({
    by: ["kind"],
    where,
    _sum: { amountCents: true },
  });
  let entradasCents = 0;
  let saidasCents = 0;
  for (const g of groups) {
    const sum = g._sum.amountCents ?? 0;
    if (g.kind === "ENTRADA") entradasCents = sum;
    if (g.kind === "SAIDA") saidasCents = sum;
  }
  return {
    entradasCents,
    saidasCents,
    saldoCents: entradasCents - saidasCents,
  };
}

export async function summarizePaymentAlerts() {
  const today = getBrazilTodayDateOnly();
  const soonEnd = new Date(today);
  soonEnd.setUTCDate(soonEnd.getUTCDate() + FINANCIAL_DUE_SOON_DAYS);

  const base = { deletedAt: null as null };

  const [dueSoonCount, dueTodayCount, overdueCount] = await Promise.all([
    prisma.financialEntry.count({
      where: {
        ...base,
        paymentStatus: "EM_ABERTO",
        entryDate: { gt: today, lte: soonEnd },
      },
    }),
    prisma.financialEntry.count({
      where: {
        ...base,
        paymentStatus: { in: ["EM_ABERTO", "PENDENTE"] },
        entryDate: today,
      },
    }),
    prisma.financialEntry.count({
      where: {
        ...base,
        paymentStatus: "PENDENTE",
        entryDate: { lt: today },
      },
    }),
  ]);

  return { dueSoonCount, dueTodayCount, overdueCount, dueSoonDays: FINANCIAL_DUE_SOON_DAYS };
}
