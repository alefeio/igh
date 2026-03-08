import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { courseLessonExerciseSchema } from "@/lib/validators/courses";

type Ctx = { params: Promise<{ id: string; moduleId: string; lessonId: string; exerciseId: string }> };

async function getExerciseAndCheck(courseId: string, moduleId: string, lessonId: string, exerciseId: string) {
  const exercise = await prisma.courseLessonExercise.findFirst({
    where: { id: exerciseId, lessonId },
    include: { lesson: { include: { module: true } } },
  });
  if (!exercise || exercise.lesson.moduleId !== moduleId || exercise.lesson.module.courseId !== courseId)
    return null;
  return exercise;
}

/** Atualiza exercício (admin). */
export async function PATCH(request: Request, context: Ctx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id: courseId, moduleId, lessonId, exerciseId } = await context.params;

  const existing = await getExerciseAndCheck(courseId, moduleId, lessonId, exerciseId);
  if (!existing) return jsonErr("NOT_FOUND", "Exercício não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = courseLessonExerciseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  await prisma.$transaction([
    prisma.courseLessonExerciseOption.deleteMany({ where: { exerciseId } }),
    prisma.courseLessonExercise.update({
      where: { id: exerciseId },
      data: {
        question: parsed.data.question.trim(),
        order: parsed.data.order ?? existing.order,
        options: {
          create: parsed.data.options.map((opt, i) => ({
            order: i,
            text: opt.text.trim(),
            isCorrect: opt.isCorrect,
          })),
        },
      },
    }),
  ]);

  const exercise = await prisma.courseLessonExercise.findUnique({
    where: { id: exerciseId },
    include: { options: { orderBy: { order: "asc" } } },
  });

  return jsonOk({
    id: exercise!.id,
    lessonId: exercise!.lessonId,
    order: exercise!.order,
    question: exercise!.question,
    options: exercise!.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, order: o.order })),
  });
}

/** Exclui exercício (admin). */
export async function DELETE(_request: Request, context: Ctx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id: courseId, moduleId, lessonId, exerciseId } = await context.params;

  const existing = await getExerciseAndCheck(courseId, moduleId, lessonId, exerciseId);
  if (!existing) return jsonErr("NOT_FOUND", "Exercício não encontrado.", 404);

  await prisma.courseLessonExercise.delete({ where: { id: exerciseId } });
  return jsonOk({ deleted: true });
}
