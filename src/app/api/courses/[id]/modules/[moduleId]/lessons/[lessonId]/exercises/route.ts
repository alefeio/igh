import { jsonErr, jsonOk } from "@/lib/http";
import { requireCourseEditAccess } from "@/lib/course-edit-access";
import { prisma } from "@/lib/prisma";
import { courseLessonExerciseSchema } from "@/lib/validators/courses";
import { createAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string; moduleId: string; lessonId: string }> };

async function getLessonAndCheck(courseId: string, moduleId: string, lessonId: string) {
  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, moduleId },
    include: { module: true },
  });
  if (!lesson || lesson.module.courseId !== courseId) return null;
  return lesson;
}

/** Lista exercícios da aula (admin ou professor do curso). */
export async function GET(_request: Request, context: Ctx) {
  const { id: courseId, moduleId, lessonId } = await context.params;

  const access = await requireCourseEditAccess(courseId);
  if ("err" in access) return access.err;

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

/** Cria exercício de múltipla escolha (admin ou professor do curso). */
export async function POST(request: Request, context: Ctx) {
  const { id: courseId, moduleId, lessonId } = await context.params;

  const access = await requireCourseEditAccess(courseId);
  if ("err" in access) return access.err;
  const { user, teacherId } = access;

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

  const teacherRecord =
    teacherId ? await prisma.teacher.findUnique({ where: { id: teacherId }, select: { name: true } }) : null;
  await createAuditLog({
    entityType: "CourseLessonExercise",
    entityId: exercise.id,
    action: "CREATE",
    diff: {
      lessonId,
      courseId,
      performedByRole: user.role,
      performedByUserName: user.name,
      ...(teacherId && { teacherId, teacherName: teacherRecord?.name ?? "Professor" }),
    },
    performedByUserId: user.id,
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
