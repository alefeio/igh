import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateCourseSchema } from "@/lib/validators/courses";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Curso não encontrado.", 404);
  }

  const updated = await prisma.course.update({
    where: { id },
    data: {
      name: parsed.data.name ?? undefined,
      description: parsed.data.description === "" ? null : (parsed.data.description ?? undefined),
      workloadHours: parsed.data.workloadHours ?? undefined,
      status: parsed.data.status ?? undefined,
    },
  });

  await createAuditLog({
    entityType: "Course",
    entityId: id,
    action: "UPDATE",
    diff: { before: existing, after: updated },
    performedByUserId: user.id,
  });

  return jsonOk({ course: updated });
}
