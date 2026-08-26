import { jsonErr, jsonOk } from "@/lib/http";
import { requireCourseEditAccess, requireCourseReadAccess } from "@/lib/course-edit-access";
import { prisma } from "@/lib/prisma";
import { courseLessonExerciseSchema } from "@/lib/validators/courses";

type Ctx = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

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

/** Lista exercícios da aula (leitura: coordenador; edição via POST). */
export async function GET(_request: Request, context: Ctx) {
  const { id: courseId, moduleId, lessonId } = await context.params;

  const access = await requireCourseReadAccess(courseId);
  if ("err" in access) return access.err;

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, moduleId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const exercises = await prisma.courseLessonExercise.findMany({
    where: { lessonId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      options: { orderBy: { order: "asc" } },
    },
  });

  return jsonOk(exercises.map(serializeExercise));
}

/** Cria exercício na aula (professor/MASTER/ADMIN). */
export async function POST(request: Request, context: Ctx) {
  const { id: courseId, moduleId, lessonId } = await context.params;

  const access = await requireCourseEditAccess(courseId);
  if ("err" in access) return access.err;

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, moduleId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = courseLessonExerciseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { question, order, options, answerJustification, imageUrl } = parsed.data;
  const orderVal = order ?? 0;
  const justification =
    typeof answerJustification === "string" && answerJustification.trim()
      ? answerJustification.trim()
      : null;

  const exercise = await prisma.courseLessonExercise.create({
    data: {
      lessonId,
      question: question.trim(),
      order: orderVal,
      imageUrl: imageUrl ?? null,
      answerJustification: justification,
    },
  });

  await prisma.courseLessonExerciseOption.createMany({
    data: options.map((opt, i) => ({
      exerciseId: exercise.id,
      text: opt.text.trim(),
      isCorrect: opt.isCorrect,
      imageUrl: opt.imageUrl ?? null,
      order: i,
    })),
  });

  const created = await prisma.courseLessonExercise.findUnique({
    where: { id: exercise.id },
    include: { options: { orderBy: { order: "asc" } } },
  });
  if (!created) return jsonErr("INTERNAL", "Erro ao criar exercício.", 500);

  return jsonOk(serializeExercise(created));
}
