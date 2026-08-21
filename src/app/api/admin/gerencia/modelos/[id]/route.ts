import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateDocumentTemplateSchema } from "@/lib/validators/admin-documents";

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
  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) return jsonErr("NOT_FOUND", "Modelo não encontrado.", 404);
  return jsonOk({ template });
}

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
  const existing = await prisma.documentTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return jsonErr("NOT_FOUND", "Modelo não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateDocumentTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const template = await prisma.documentTemplate.update({
    where: { id },
    data: parsed.data,
  });

  await createAuditLog({
    entityType: "DocumentTemplate",
    entityId: id,
    action: "UPDATE",
    diff: { fields: Object.keys(parsed.data) },
    performedByUserId: actor.id,
  });

  return jsonOk({ template });
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
  const existing = await prisma.documentTemplate.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!existing) return jsonErr("NOT_FOUND", "Modelo não encontrado.", 404);

  await prisma.documentTemplate.delete({ where: { id } });
  await createAuditLog({
    entityType: "DocumentTemplate",
    entityId: id,
    action: "DELETE",
    diff: { title: existing.title },
    performedByUserId: actor.id,
  });

  return jsonOk({ deleted: true });
}
