import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";
import { courseModuleSchema } from "@/lib/validators/courses";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id: courseId } = await context.params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    return jsonErr("NOT_FOUND", "Curso não encontrado.", 404);
  }

  const modules = await getModulesWithLessonsByCourseId(courseId);
  return jsonOk({ modules });
}

export async function POST(request: Request, context: Ctx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id: courseId } = await context.params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    return jsonErr("NOT_FOUND", "Curso não encontrado.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = courseModuleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const moduleRow = await prisma.courseModule.create({
    data: {
      courseId,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      order: parsed.data.order,
    },
  });
  const modules = await getModulesWithLessonsByCourseId(courseId);
  return jsonOk({ item: moduleRow, modules }, { status: 201 });
}
