import { prisma } from "@/lib/prisma";
import { requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { applyClassGroupUpdate } from "@/lib/class-group-update";
import { updateClassGroupSchema } from "@/lib/validators/class-groups";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireStaffWrite();
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateClassGroupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const result = await applyClassGroupUpdate({
    id,
    data: parsed.data,
    performedByUserId: user.id,
  });
  if (!result.ok) return jsonErr(result.code, result.message, result.status);
  return jsonOk({ classGroup: result.classGroup });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffWrite();
  const { id } = await context.params;

  const existing = await prisma.classGroup.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  await prisma.$transaction([
    prisma.classSession.deleteMany({ where: { classGroupId: id } }),
    prisma.classGroup.delete({ where: { id } }),
  ]);

  await createAuditLog({
    entityType: "ClassGroup",
    entityId: id,
    action: "DELETE",
    diff: { before: existing },
    performedByUserId: user.id,
  });

  return jsonOk({ deleted: true });
}
