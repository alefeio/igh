import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateTeacherSchema } from "@/lib/validators/teachers";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateTeacherSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.teacher.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return jsonErr("NOT_FOUND", "Professor não encontrado.", 404);
  }

  const updated = await prisma.teacher.update({
    where: { id },
    data: {
      name: parsed.data.name ?? undefined,
      phone: parsed.data.phone === "" ? null : (parsed.data.phone ?? undefined),
      email: parsed.data.email === "" ? null : (parsed.data.email ?? undefined),
      isActive: parsed.data.isActive ?? undefined,
    },
  });

  await createAuditLog({
    entityType: "Teacher",
    entityId: id,
    action: "UPDATE",
    diff: { before: existing, after: updated },
    performedByUserId: user.id,
  });

  return jsonOk({ teacher: updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const existing = await prisma.teacher.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return jsonErr("NOT_FOUND", "Professor não encontrado.", 404);
  }

  const updated = await prisma.teacher.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await createAuditLog({
    entityType: "Teacher",
    entityId: id,
    action: "SOFT_DELETE",
    diff: { before: existing, after: updated },
    performedByUserId: user.id,
  });

  return jsonOk({ teacher: updated });
}
