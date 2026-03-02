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

  const data: Parameters<typeof prisma.course.update>[0]["data"] = {
    name: parsed.data.name ?? undefined,
    description: parsed.data.description === "" ? null : (parsed.data.description ?? undefined),
    content: parsed.data.content === "" ? null : (parsed.data.content ?? undefined),
    imageUrl: parsed.data.imageUrl === "" ? null : (parsed.data.imageUrl ?? undefined),
    workloadHours: parsed.data.workloadHours ?? undefined,
    status: parsed.data.status ?? undefined,
  };
  if (parsed.data.slug !== undefined) {
    const slug = parsed.data.slug.trim();
    if (slug) {
      const dup = await prisma.course.findFirst({ where: { slug, NOT: { id } }, select: { id: true } });
      if (dup) return jsonErr("DUPLICATE_SLUG", "Já existe um curso com este slug.", 409);
      data.slug = slug;
    }
  }

  const updated = await prisma.course.update({
    where: { id },
    data,
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

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireRole("MASTER");
  const { id } = await context.params;

  const existing = await prisma.course.findUnique({
    where: { id },
    include: { _count: { select: { classGroups: true } } },
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Curso não encontrado.", 404);
  }

  if (existing._count.classGroups > 0) {
    await prisma.course.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
    await createAuditLog({
      entityType: "Course",
      entityId: id,
      action: "COURSE_INACTIVATE",
      diff: { reason: "has_class_groups", courseId: id },
      performedByUserId: user.id,
    });
    return jsonOk({ inactivated: true, message: "Curso possui turmas; foi inativado." });
  }

  await prisma.course.delete({ where: { id } });
  await createAuditLog({
    entityType: "Course",
    entityId: id,
    action: "COURSE_DELETE",
    diff: { before: existing },
    performedByUserId: user.id,
  });
  return jsonOk({ deleted: true });
}
