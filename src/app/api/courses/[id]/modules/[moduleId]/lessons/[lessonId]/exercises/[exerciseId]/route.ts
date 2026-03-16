import { jsonErr, jsonOk } from "@/lib/http";
import { requireCourseEditAccess } from "@/lib/course-edit-access";
import { prisma } from "@/lib/prisma";
import { courseLessonExerciseSchema } from "@/lib/validators/courses";

type Ctx = { params: Promise<{ id: string; moduleId: string; lessonId: string; exerciseId: string }> };

/** Atualiza exercício (professor/MASTER/ADMIN). */
export async function PATCH(request: Request, context: Ctx) {
  const { id: courseId, moduleId, lessonId, exerciseId } = await context.params;

  const access = await requireCourseEditAccess(courseId);
  if ("err" in access) return access.err;

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, moduleId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const exercise = await prisma.courseLessonExercise.findFirst({
    where: { id: exerciseId, lessonId },
  });
  if (!exercise) return jsonErr("NOT_FOUND", "Exercício não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = courseLessonExerciseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { question, order, options } = parsed.data;
  const orderVal = order ?? exercise.order;

  await prisma.$transaction([
    prisma.courseLessonExercise.update({
      where: { id: exerciseId },
      data: { question: question.trim(), order: orderVal },
    }),
    prisma.courseLessonExerciseOption.deleteMany({ where: { exerciseId } }),
    prisma.courseLessonExerciseOption.createMany({
      data: options.map((opt, i) => ({
        exerciseId,
        text: opt.text.trim(),
        isCorrect: opt.isCorrect,
        order: i,
      })),
    }),
  ]);

  const updated = await prisma.courseLessonExercise.findUnique({
    where: { id: exerciseId },
    include: { options: { orderBy: { order: "asc" } } },
  });
  if (!updated) return jsonErr("INTERNAL", "Erro ao atualizar exercício.", 500);

  return jsonOk({
    id: updated.id,
    lessonId: updated.lessonId,
    order: updated.order,
    question: updated.question,
    options: updated.options.map((o) => ({
      id: o.id,
      text: o.text,
      isCorrect: o.isCorrect,
      order: o.order,
    })),
  });
}

/** Exclui exercício (professor/MASTER/ADMIN). */
export async function DELETE(_request: Request, context: Ctx) {
  const { id: courseId, moduleId, lessonId, exerciseId } = await context.params;

  const access = await requireCourseEditAccess(courseId);
  if ("err" in access) return access.err;

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, moduleId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const exercise = await prisma.courseLessonExercise.findFirst({
    where: { id: exerciseId, lessonId },
  });
  if (!exercise) return jsonErr("NOT_FOUND", "Exercício não encontrado.", 404);

  await prisma.courseLessonExercise.delete({ where: { id: exerciseId } });

  return jsonOk({ deleted: true });
}
