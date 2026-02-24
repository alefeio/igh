import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { updateClassGroupSchema } from "@/lib/validators/class-groups";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = updateClassGroupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.classGroup.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  if (parsed.data.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: parsed.data.courseId },
      select: { id: true },
    });
    if (!course) return jsonErr("INVALID_COURSE", "Curso inválido.", 400);
  }
  if (parsed.data.teacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: parsed.data.teacherId },
      select: { id: true, deletedAt: true },
    });
    if (!teacher || teacher.deletedAt)
      return jsonErr("INVALID_TEACHER", "Professor inválido.", 400);
  }

  const updated = await prisma.classGroup.update({
    where: { id },
    data: {
      courseId: parsed.data.courseId ?? undefined,
      teacherId: parsed.data.teacherId ?? undefined,
      daysOfWeek: parsed.data.daysOfWeek ?? undefined,
      startTime: parsed.data.startTime ?? undefined,
      endTime: parsed.data.endTime ?? undefined,
      capacity: parsed.data.capacity ?? undefined,
      status: parsed.data.status ?? undefined,
      location: parsed.data.location === "" ? null : (parsed.data.location ?? undefined),
    },
  });

  await createAuditLog({
    entityType: "ClassGroup",
    entityId: id,
    action: "UPDATE",
    diff: { before: existing, after: updated },
    performedByUserId: user.id,
  });

  return jsonOk({ classGroup: updated });
}
