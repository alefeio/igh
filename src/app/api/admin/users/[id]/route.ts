import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateAdminSchema } from "@/lib/validators/users";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const master = await requireRole("MASTER");
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateAdminSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true, name: true, isActive: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Usuário não encontrado.", 404);
  if (existing.role === "MASTER") return jsonErr("FORBIDDEN", "Não é permitido editar o usuário MASTER.", 403);

  const updateData: { name?: string; email?: string; passwordHash?: string; isActive?: boolean } = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
  if (parsed.data.password !== undefined && parsed.data.password !== "") {
    updateData.passwordHash = await hashPassword(parsed.data.password);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, isActive: true, updatedAt: true },
  });

  await createAuditLog({
    entityType: "User",
    entityId: id,
    action: "ADMIN_UPDATE",
    diff: { before: existing, after: updated },
    performedByUserId: master.id,
  });

  return jsonOk({ user: updated });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const master = await requireRole("MASTER");
  const { id } = await context.params;

  if (id === master.id) {
    return jsonErr("FORBIDDEN", "Não é permitido desativar o próprio usuário.", 403);
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true, name: true, isActive: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Usuário não encontrado.", 404);
  if (existing.role === "MASTER") return jsonErr("FORBIDDEN", "Não é permitido desativar o usuário MASTER.", 403);

  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get("permanent") === "true" || searchParams.get("permanent") === "1";

  if (permanent && !existing.isActive) {
    await prisma.user.delete({ where: { id } });
    await createAuditLog({
      entityType: "User",
      entityId: id,
      action: "ADMIN_DELETE",
      diff: { before: existing },
      performedByUserId: master.id,
    });
    return jsonOk({ deleted: true });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  await createAuditLog({
    entityType: "User",
    entityId: id,
    action: "ADMIN_DEACTIVATE",
    diff: { before: existing, after: updated },
    performedByUserId: master.id,
  });

  return jsonOk({ user: updated });
}
