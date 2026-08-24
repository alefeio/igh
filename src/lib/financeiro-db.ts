import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  mergeFinancialAttachments,
  primaryAttachmentFields,
  type FinancialAttachmentInput,
} from "@/lib/financeiro-attachments";
import type { FinancialEntryView } from "@/lib/financeiro";
import {
  addCalendarMonth,
  buildFixedExpensePatterns,
  findMissingFixedExpenses,
  forecastFromPatterns,
  type FixedExpenseAlert,
} from "@/lib/financeiro-fixed-expenses";
import { computeDueUrgency, FINANCIAL_DUE_SOON_DAYS, brazilTodayIsoDate } from "@/lib/financeiro-payment-shared";
import { prisma } from "@/lib/prisma";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import type { FinancialListQuery } from "@/lib/validators/financeiro";

export const financialEntryInclude = {
  category: { select: { id: true, name: true, kind: true } },
  polo: { select: { id: true, name: true } },
  responsibleUser: { select: { id: true, name: true, email: true } },
  createdByUser: { select: { id: true, name: true } },
  attachments: { orderBy: { createdAt: "asc" as const } },
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
    attachments: mergeFinancialAttachments(row.attachments, {
      attachmentUrl: row.attachmentUrl,
      attachmentPublicId: row.attachmentPublicId,
      attachmentFileName: row.attachmentFileName,
    }),
    expenseNature: row.expenseNature,
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
  if (query.expenseNature === "NONE") {
    and.push({ kind: "SAIDA", expenseNature: null });
  } else if (query.expenseNature) {
    and.push({ kind: "SAIDA", expenseNature: query.expenseNature });
  }
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
  const [kindGroups, natureGroups] = await Promise.all([
    prisma.financialEntry.groupBy({
      by: ["kind"],
      where,
      _sum: { amountCents: true },
    }),
    prisma.financialEntry.groupBy({
      by: ["expenseNature"],
      where: { AND: [where, { kind: "SAIDA" }] },
      _sum: { amountCents: true },
    }),
  ]);
  let entradasCents = 0;
  let saidasCents = 0;
  for (const g of kindGroups) {
    const sum = g._sum.amountCents ?? 0;
    if (g.kind === "ENTRADA") entradasCents = sum;
    if (g.kind === "SAIDA") saidasCents = sum;
  }
  let saidasFixasCents = 0;
  let saidasVariaveisCents = 0;
  for (const g of natureGroups) {
    const sum = g._sum.amountCents ?? 0;
    if (g.expenseNature === "FIXA") saidasFixasCents = sum;
    else saidasVariaveisCents += sum;
  }
  return {
    entradasCents,
    saidasCents,
    saidasFixasCents,
    saidasVariaveisCents,
    saldoCents: entradasCents - saidasCents,
  };
}

export type FixedExpenseInsights = {
  targetMonth: string;
  currentMonth: string;
  nextMonth: string;
  alerts: FixedExpenseAlert[];
  forecast: {
    currentExpectedCents: number;
    nextExpectedCents: number;
    currentItems: Array<{
      description: string;
      categoryName: string | null;
      expectedAmountCents: number;
    }>;
    nextItems: Array<{
      description: string;
      categoryName: string | null;
      expectedAmountCents: number;
    }>;
  };
};

export async function buildFixedExpenseInsights(query: FinancialListQuery): Promise<FixedExpenseInsights> {
  const currentMonth = brazilTodayIsoDate().slice(0, 7);
  const nextMonth = addCalendarMonth(currentMonth, 1);
  const targetMonth =
    query.month || (query.dateFrom ? query.dateFrom.toISOString().slice(0, 7) : currentMonth);

  const [ty, tm] = currentMonth.split("-").map(Number);
  const lookbackStart = new Date(Date.UTC(ty, tm - 1 - 6, 1));
  const [targetY, targetM] = targetMonth.split("-").map(Number);

  const [fixedRows, targetMonthRows] = await Promise.all([
    prisma.financialEntry.findMany({
      where: {
        deletedAt: null,
        kind: "SAIDA",
        expenseNature: "FIXA",
        entryDate: { gte: lookbackStart },
      },
      select: {
        description: true,
        amountCents: true,
        entryDate: true,
        categoryId: true,
        category: { select: { name: true } },
      },
      orderBy: { entryDate: "desc" },
    }),
    prisma.financialEntry.findMany({
      where: {
        deletedAt: null,
        kind: "SAIDA",
        entryDate: {
          gte: new Date(`${targetMonth}-01T00:00:00.000Z`),
          lte: new Date(Date.UTC(targetY, targetM, 0)),
        },
      },
      select: { description: true, categoryId: true },
    }),
  ]);

  const patterns = buildFixedExpensePatterns(
    fixedRows.map((r) => ({
      description: r.description,
      amountCents: r.amountCents,
      entryDate: r.entryDate.toISOString().slice(0, 10),
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? null,
    })),
  );

  const forecast = forecastFromPatterns(patterns);
  const alerts = findMissingFixedExpenses(patterns, targetMonthRows, targetMonth);

  return {
    targetMonth,
    currentMonth,
    nextMonth,
    alerts,
    forecast: {
      currentExpectedCents: forecast.expectedCents,
      nextExpectedCents: forecast.expectedCents,
      currentItems: forecast.items,
      nextItems: forecast.items,
    },
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

export async function replaceFinancialAttachments(
  entryId: string,
  items: FinancialAttachmentInput[],
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  await db.financialEntryAttachment.deleteMany({ where: { financialEntryId: entryId } });
  if (items.length > 0) {
    await db.financialEntryAttachment.createMany({
      data: items.map((a) => ({
        financialEntryId: entryId,
        url: a.url,
        publicId: a.publicId ?? null,
        fileName: a.fileName ?? null,
        description: a.description,
      })),
    });
  }
  return primaryAttachmentFields(items);
}
