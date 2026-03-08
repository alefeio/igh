import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { courseLessonExerciseSchema } from "@/lib/validators/courses";

type Ctx = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

async function getLessonAndCheck(courseId: string, moduleId: string, lessonId: string) {
  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, moduleId },
    include: { module: true },
  });
  if (!lesson || lesson.module.courseId !== courseId) return null;
  return lesson;
}

/** Lista exercícios da aula (admin). */
export async function GET(_request: Request, context: Ctx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id: courseId, moduleId, lessonId } = await context.params;

  const lesson = await getLessonAndCheck(courseId, moduleId, lessonId);
  if (!lesson) return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);

  const exercises = await prisma.courseLessonExercise.findMany({
    where: { lessonId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      options: { orderBy: { order: "asc" } },
    },
  });

  return jsonOk(
    exercises.map((ex) => ({
      id: ex.id,
      lessonId: ex.lessonId,
      order: ex.order,
      question: ex.question,
      options: ex.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, order: o.order })),
    }))
  );
}

/** Cria exercício de múltipla escolha (admin). */
export async function POST(request: Request, context: Ctx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id: courseId, moduleId, lessonId } = await context.params;

  const lesson = await getLessonAndCheck(courseId, moduleId, lessonId);
  if (!lesson) return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);

  const body = await request.json().catch(() => null);
  const parsed = courseLessonExerciseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const order = parsed.data.order ?? 0;
  const exercise = await prisma.courseLessonExercise.create({
    data: {
      lessonId,
      order,
      question: parsed.data.question.trim(),
      options: {
        create: parsed.data.options.map((opt, i) => ({
          order: i,
          text: opt.text.trim(),
          isCorrect: opt.isCorrect,
        })),
      },
    },
    include: { options: { orderBy: { order: "asc" } } },
  });

  return jsonOk(
    {
      id: exercise.id,
      lessonId: exercise.lessonId,
      order: exercise.order,
      question: exercise.question,
      options: exercise.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, order: o.order })),
    },
    { status: 201 }
  );
}
