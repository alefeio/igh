import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  financialEntryInclude,
  financialEntryWhere,
  serializeFinancialEntry,
  sumFinancialTotals,
} from "@/lib/financeiro-db";
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

  const query = parseFinancialListQuery(new URL(request.url).searchParams);
  const where = financialEntryWhere(query);

  const [entries, totals, count] = await Promise.all([
    prisma.financialEntry.findMany({
      where,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      include: financialEntryInclude,
      take: 500,
    }),
    sumFinancialTotals(where),
    prisma.financialEntry.count({ where }),
  ]);

  return jsonOk({
    entries: entries.map(serializeFinancialEntry),
    totals,
    count,
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

  const entry = await prisma.financialEntry.create({
    data: {
      kind: data.kind,
      description: data.description,
      amountCents: data.amount,
      entryDate: data.entryDate,
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
      createdByUserId: actor.id,
    },
    include: financialEntryInclude,
  });

  await createAuditLog({
    entityType: "FinancialEntry",
    entityId: entry.id,
    action: "CREATE",
    diff: { kind: entry.kind, amountCents: entry.amountCents, description: entry.description },
    performedByUserId: actor.id,
  });

  return jsonOk({ entry: serializeFinancialEntry(entry) }, { status: 201 });
}
