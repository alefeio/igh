import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";
import { courseModuleSchema } from "@/lib/validators/courses";

type Ctx = { params: Promise<{ id: string; moduleId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id: courseId, moduleId } = await context.params;

  const existing = await prisma.courseModule.findFirst({
    where: { id: moduleId, courseId },
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Módulo não encontrado.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = courseModuleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  await prisma.courseModule.update({
    where: { id: moduleId },
    data: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      order: parsed.data.order,
    },
  });
  const modules = await getModulesWithLessonsByCourseId(courseId);
  return jsonOk({ modules });
}

export async function DELETE(_request: Request, context: Ctx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id: courseId, moduleId } = await context.params;

  const existing = await prisma.courseModule.findFirst({
    where: { id: moduleId, courseId },
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Módulo não encontrado.", 404);
  }

  await prisma.courseModule.delete({ where: { id: moduleId } });
  const modules = await getModulesWithLessonsByCourseId(courseId);
  return jsonOk({ modules });
}
