import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateInventoryItemSchema } from "@/lib/validators/inventory-donations";

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
  const item = await prisma.inventoryItem.findFirst({
    where: { id, deletedAt: null },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          responsibleUser: { select: { id: true, name: true } },
          createdByUser: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!item) return jsonErr("NOT_FOUND", "Item não encontrado.", 404);

  return jsonOk({
    item: {
      ...item,
      lowStock: item.quantityOnHand <= item.minStock,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      movements: item.movements.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
    },
  });
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
  const existing = await prisma.inventoryItem.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Item não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateInventoryItemSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const data = { ...parsed.data };
  if (data.code !== undefined) {
    data.code = data.code?.trim() ? data.code.trim() : null;
  }

  try {
    const item = await prisma.inventoryItem.update({ where: { id }, data });
    await createAuditLog({
      entityType: "InventoryItem",
      entityId: id,
      action: "UPDATE",
      diff: { fields: Object.keys(parsed.data) },
      performedByUserId: actor.id,
    });
    return jsonOk({
      item: {
        ...item,
        lowStock: item.quantityOnHand <= item.minStock,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return jsonErr("DUPLICATE", "Já existe um item com este código.", 409);
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
  const existing = await prisma.inventoryItem.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Item não encontrado.", 404);

  await prisma.inventoryItem.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  await createAuditLog({
    entityType: "InventoryItem",
    entityId: id,
    action: "ARCHIVE",
    diff: { name: existing.name },
    performedByUserId: actor.id,
  });
  return jsonOk({ archived: true });
}
