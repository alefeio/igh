import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { serializeEquipment } from "@/lib/equipment-catalog";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateEquipmentSchema } from "@/lib/validators/equipment-visits";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.equipmentCatalogItem.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Equipamento não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateEquipmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const item = await prisma.equipmentCatalogItem.update({
      where: { id },
      data: parsed.data,
    });
    await createAuditLog({
      entityType: "EquipmentCatalogItem",
      entityId: id,
      action: "UPDATE",
      diff: { fields: Object.keys(parsed.data) },
      performedByUserId: actor.id,
    });
    return jsonOk({ item: serializeEquipment(item) });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return jsonErr("DUPLICATE", "Já existe um equipamento com este nome.", 409);
    }
    throw e;
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.equipmentCatalogItem.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Equipamento não encontrado.", 404);

  await prisma.equipmentCatalogItem.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  await createAuditLog({
    entityType: "EquipmentCatalogItem",
    entityId: id,
    action: "ARCHIVE",
    diff: { name: existing.name },
    performedByUserId: actor.id,
  });
  return jsonOk({ archived: true });
}
