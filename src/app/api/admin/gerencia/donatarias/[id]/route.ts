import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateDonatariaSchema } from "@/lib/validators/inventory-donations";

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
  const existing = await prisma.donataria.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Donatária não encontrada.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateDonatariaSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const donataria = await prisma.donataria.update({ where: { id }, data: parsed.data });
  await createAuditLog({
    entityType: "Donataria",
    entityId: id,
    action: "UPDATE",
    diff: { fields: Object.keys(parsed.data) },
    performedByUserId: actor.id,
  });

  return jsonOk({
    donataria: {
      ...donataria,
      createdAt: donataria.createdAt.toISOString(),
      updatedAt: donataria.updatedAt.toISOString(),
    },
  });
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
  const existing = await prisma.donataria.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Donatária não encontrada.", 404);

  await prisma.donataria.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  await createAuditLog({
    entityType: "Donataria",
    entityId: id,
    action: "ARCHIVE",
    diff: { name: existing.name },
    performedByUserId: actor.id,
  });
  return jsonOk({ archived: true });
}
