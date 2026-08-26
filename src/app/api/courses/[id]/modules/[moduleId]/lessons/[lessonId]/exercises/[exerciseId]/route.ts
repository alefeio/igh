import { jsonErr, jsonOk } from "@/lib/http";
import { requireCourseEditAccess } from "@/lib/course-edit-access";
import { prisma } from "@/lib/prisma";
import { courseLessonExerciseSchema } from "@/lib/validators/courses";

type Ctx = { params: Promise<{ id: string; moduleId: string; lessonId: string; exerciseId: string }> };

function serializeExercise(ex: {
  id: string;
  lessonId: string;
  order: number;
  question: string;
  imageUrl: string | null;
  answerJustification: string | null;
  options: { id: string; text: string; imageUrl: string | null; isCorrect: boolean; order: number }[];
}) {
  return {
    id: ex.id,
    lessonId: ex.lessonId,
    order: ex.order,
    question: ex.question,
    imageUrl: ex.imageUrl,
    answerJustification: ex.answerJustification,
    options: ex.options.map((o) => ({
      id: o.id,
      text: o.text,
      imageUrl: o.imageUrl,
      isCorrect: o.isCorrect,
      order: o.order,
    })),
  };
}

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

  const { question, order, options, answerJustification, imageUrl } = parsed.data;
  const orderVal = order ?? exercise.order;
  const justification =
    typeof answerJustification === "string" && answerJustification.trim()
      ? answerJustification.trim()
      : null;

  await prisma.$transaction([
    prisma.courseLessonExercise.update({
      where: { id: exerciseId },
      data: {
        question: question.trim(),
        order: orderVal,
        imageUrl: imageUrl ?? null,
        answerJustification: justification,
      },
    }),
    prisma.courseLessonExerciseOption.deleteMany({ where: { exerciseId } }),
    prisma.courseLessonExerciseOption.createMany({
      data: options.map((opt, i) => ({
        exerciseId,
        text: opt.text.trim(),
        isCorrect: opt.isCorrect,
        imageUrl: opt.imageUrl ?? null,
        order: i,
      })),
    }),
  ]);

  const updated = await prisma.courseLessonExercise.findUnique({
    where: { id: exerciseId },
    include: { options: { orderBy: { order: "asc" } } },
  });
  if (!updated) return jsonErr("INTERNAL", "Erro ao atualizar exercício.", 500);

  return jsonOk(serializeExercise(updated));
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
