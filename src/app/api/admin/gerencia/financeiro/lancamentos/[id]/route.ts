import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  financialEntryInclude,
  serializeFinancialEntry,
} from "@/lib/financeiro-db";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateFinancialEntrySchema } from "@/lib/validators/financeiro";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const entry = await prisma.financialEntry.findFirst({
    where: { id, deletedAt: null },
    include: financialEntryInclude,
  });
  if (!entry) return jsonErr("NOT_FOUND", "Lançamento não encontrado.", 404);
  return jsonOk({ entry: serializeFinancialEntry(entry) });
}

export async function PATCH(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.financialEntry.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, kind: true, paymentStatus: true, paidAt: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Lançamento não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateFinancialEntrySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = parsed.data;
  const nextKind = data.kind ?? existing.kind;

  if (data.categoryId) {
    const cat = await prisma.financialCategory.findFirst({
      where: { id: data.categoryId, isActive: true },
      select: { id: true, kind: true },
    });
    if (!cat) return jsonErr("NOT_FOUND", "Categoria não encontrada.", 404);
    if (cat.kind !== nextKind) {
      return jsonErr("VALIDATION_ERROR", "A categoria não corresponde ao tipo do lançamento.", 400);
    }
  }

  let paidAtUpdate: Date | null | undefined = undefined;
  if (data.paymentStatus !== undefined) {
    if (data.paymentStatus === "PAGO") {
      paidAtUpdate = existing.paidAt ?? getBrazilTodayDateOnly();
    } else {
      paidAtUpdate = null;
    }
  }

  const entry = await prisma.financialEntry.update({
    where: { id },
    data: {
      kind: data.kind,
      description: data.description,
      amountCents: data.amount === undefined ? undefined : data.amount ?? undefined,
      entryDate: data.entryDate,
      paymentStatus: data.paymentStatus,
      paidAt: paidAtUpdate,
      categoryId: data.categoryId === undefined ? undefined : data.categoryId,
      paymentMethod: data.paymentMethod,
      poloId: data.poloId === undefined ? undefined : data.poloId,
      responsibleUserId: data.responsibleUserId === undefined ? undefined : data.responsibleUserId,
      responsibleName: data.responsibleName === undefined ? undefined : data.responsibleName,
      invoiceNumber: data.invoiceNumber === undefined ? undefined : data.invoiceNumber,
      supplier: data.supplier === undefined ? undefined : data.supplier,
      notes: data.notes === undefined ? undefined : data.notes,
      attachmentUrl: data.attachmentUrl === undefined ? undefined : data.attachmentUrl,
      attachmentPublicId: data.attachmentPublicId === undefined ? undefined : data.attachmentPublicId,
      attachmentFileName: data.attachmentFileName === undefined ? undefined : data.attachmentFileName,
    },
    include: financialEntryInclude,
  });

  await createAuditLog({
    entityType: "FinancialEntry",
    entityId: id,
    action: "UPDATE",
    diff: { fields: Object.keys(parsed.data) },
    performedByUserId: actor.id,
  });

  return jsonOk({ entry: serializeFinancialEntry(entry) });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.financialEntry.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Lançamento não encontrado.", 404);

  await prisma.financialEntry.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    entityType: "FinancialEntry",
    entityId: id,
    action: "ARCHIVE",
    diff: {},
    performedByUserId: actor.id,
  });

  return jsonOk({ archived: true });
}
