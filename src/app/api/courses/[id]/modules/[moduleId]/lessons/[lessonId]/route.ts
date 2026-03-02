import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";
import { courseLessonSchema } from "@/lib/validators/courses";

type Ctx = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id: courseId, moduleId, lessonId } = await context.params;

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, moduleId },
    include: { module: true },
  });
  if (!lesson || lesson.module.courseId !== courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = courseLessonSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  await prisma.courseLesson.update({
    where: { id: lessonId },
    data: {
      title: parsed.data.title.trim(),
      order: parsed.data.order,
      durationMinutes: parsed.data.durationMinutes ?? null,
      contentRich: parsed.data.contentRich?.trim() || null,
    },
  });
  const modules = await getModulesWithLessonsByCourseId(courseId);
  return jsonOk({ modules });
}

export async function DELETE(_request: Request, context: Ctx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id: courseId, moduleId, lessonId } = await context.params;

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, moduleId },
    include: { module: true },
  });
  if (!lesson || lesson.module.courseId !== courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  await prisma.courseLesson.delete({ where: { id: lessonId } });
  const modules = await getModulesWithLessonsByCourseId(courseId);
  return jsonOk({ modules });
}
