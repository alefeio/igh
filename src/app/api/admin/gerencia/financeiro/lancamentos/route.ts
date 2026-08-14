import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  financialEntryInclude,
  financialEntryWhere,
  serializeFinancialEntry,
  sumFinancialTotals,
  summarizePaymentAlerts,
  buildFixedExpenseInsights,
} from "@/lib/financeiro-db";
import { resolveSaidaExpenseNature } from "@/lib/financeiro";
import { resolveInitialPaymentStatus, syncFinancialPaymentLifecycle } from "@/lib/financeiro-payment";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  createFinancialEntrySchema,
  parseFinancialListQuery,
} from "@/lib/validators/financeiro";

export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  // Ao abrir a listagem: em aberto vencido → pendente + notificações do dia.
  await syncFinancialPaymentLifecycle().catch((err) => {
    console.error("[financeiro] sync lifecycle failed:", err);
  });

  const query = parseFinancialListQuery(new URL(request.url).searchParams);
  const where = financialEntryWhere(query);

  const [entries, totals, count, alerts, fixedInsights] = await Promise.all([
    prisma.financialEntry.findMany({
      where,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      include: financialEntryInclude,
      take: 500,
    }),
    sumFinancialTotals(where),
    prisma.financialEntry.count({ where }),
    summarizePaymentAlerts(),
    buildFixedExpenseInsights(query),
  ]);

  return jsonOk({
    entries: entries.map(serializeFinancialEntry),
    totals,
    count,
    alerts,
    fixedExpenseAlerts: fixedInsights.alerts,
    fixedExpenseForecast: fixedInsights.forecast,
    fixedExpenseMeta: {
      targetMonth: fixedInsights.targetMonth,
      currentMonth: fixedInsights.currentMonth,
      nextMonth: fixedInsights.nextMonth,
    },
    filters: query,
  });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createFinancialEntrySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = parsed.data;

  if (data.categoryId) {
    const cat = await prisma.financialCategory.findFirst({
      where: { id: data.categoryId, isActive: true },
      select: { id: true, kind: true },
    });
    if (!cat) return jsonErr("NOT_FOUND", "Categoria não encontrada.", 404);
    if (cat.kind !== data.kind) {
      return jsonErr("VALIDATION_ERROR", "A categoria não corresponde ao tipo do lançamento.", 400);
    }
  }

  const initial = resolveInitialPaymentStatus({
    dueDate: data.entryDate,
    alreadyPaid: data.alreadyPaid ?? (data.paymentStatus === "PAGO" ? true : data.paymentStatus === "PENDENTE" ? false : null),
  });

  const entry = await prisma.financialEntry.create({
    data: {
      kind: data.kind,
      description: data.description,
      amountCents: data.amount,
      entryDate: data.entryDate,
      paymentStatus: initial.paymentStatus,
      paidAt: initial.paidAt,
      categoryId: data.categoryId ?? null,
      paymentMethod: data.paymentMethod,
      poloId: data.poloId ?? null,
      responsibleUserId: data.responsibleUserId ?? null,
      responsibleName: data.responsibleName ?? null,
      invoiceNumber: data.invoiceNumber ?? null,
      supplier: data.supplier ?? null,
      notes: data.notes ?? null,
      attachmentUrl: data.attachmentUrl ?? null,
      attachmentPublicId: data.attachmentPublicId ?? null,
      attachmentFileName: data.attachmentFileName ?? null,
      expenseNature: resolveSaidaExpenseNature(data.kind, data.expenseNature),
      createdByUserId: actor.id,
    },
    include: financialEntryInclude,
  });

  await createAuditLog({
    entityType: "FinancialEntry",
    entityId: entry.id,
    action: "CREATE",
    diff: {
      kind: entry.kind,
      amountCents: entry.amountCents,
      description: entry.description,
      paymentStatus: entry.paymentStatus,
    },
    performedByUserId: actor.id,
  });

  return jsonOk({ entry: serializeFinancialEntry(entry) }, { status: 201 });
}
