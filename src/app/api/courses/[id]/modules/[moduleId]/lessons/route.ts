import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";
import { courseLessonSchema } from "@/lib/validators/courses";

type Ctx = { params: Promise<{ id: string; moduleId: string }> };

export async function POST(request: Request, context: Ctx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id: courseId, moduleId } = await context.params;

  const moduleRow = await prisma.courseModule.findFirst({
    where: { id: moduleId, courseId },
  });
  if (!moduleRow) {
    return jsonErr("NOT_FOUND", "Módulo não encontrado.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = courseLessonSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  await prisma.courseLesson.create({
    data: {
      moduleId,
      title: parsed.data.title.trim(),
      order: parsed.data.order,
      durationMinutes: parsed.data.durationMinutes ?? null,
      videoUrl: parsed.data.videoUrl?.trim() || null,
      imageUrls: parsed.data.imageUrls ?? [],
      contentRich: parsed.data.contentRich?.trim() || null,
    },
  });
  const modules = await getModulesWithLessonsByCourseId(courseId);
  return jsonOk({ modules }, { status: 201 });
}
