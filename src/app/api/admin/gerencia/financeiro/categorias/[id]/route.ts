import { Prisma } from "@/generated/prisma/client";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateFinancialCategorySchema } from "@/lib/validators/financeiro";

type Ctx = { params: Promise<{ id: string }> };

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
  const existing = await prisma.financialCategory.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return jsonErr("NOT_FOUND", "Categoria não encontrada.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateFinancialCategorySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const category = await prisma.financialCategory.update({
      where: { id },
      data: parsed.data,
    });
    await createAuditLog({
      entityType: "FinancialCategory",
      entityId: id,
      action: "UPDATE",
      diff: { fields: Object.keys(parsed.data) },
      performedByUserId: actor.id,
    });
    return jsonOk({
      category: {
        ...category,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonErr("DUPLICATE", "Já existe uma categoria com este nome para este tipo.", 409);
    }
    throw e;
  }
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
  const existing = await prisma.financialCategory.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { entries: true } } },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Categoria não encontrada.", 404);

  if (existing._count.entries > 0) {
    const category = await prisma.financialCategory.update({
      where: { id },
      data: { isActive: false },
    });
    await createAuditLog({
      entityType: "FinancialCategory",
      entityId: id,
      action: "DEACTIVATE",
      diff: { name: existing.name },
      performedByUserId: actor.id,
    });
    return jsonOk({
      deactivated: true,
      category: {
        ...category,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      },
    });
  }

  await prisma.financialCategory.delete({ where: { id } });
  await createAuditLog({
    entityType: "FinancialCategory",
    entityId: id,
    action: "DELETE",
    diff: { name: existing.name },
    performedByUserId: actor.id,
  });
  return jsonOk({ deleted: true });
}
