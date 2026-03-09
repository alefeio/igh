import { jsonErr, jsonOk } from "@/lib/http";
import { requireCourseEditAccess } from "@/lib/course-edit-access";
import { prisma } from "@/lib/prisma";
import { courseLessonExerciseSchema } from "@/lib/validators/courses";
import { createAuditLog } from "@/lib/audit";

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

/** Atualiza exercício (admin ou professor do curso). */
export async function PATCH(request: Request, context: Ctx) {
  const { id: courseId, moduleId, lessonId, exerciseId } = await context.params;

  const access = await requireCourseEditAccess(courseId);
  if ("err" in access) return access.err;
  const { user, teacherId } = access;

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
    include: { lesson: { include: { module: { include: { course: { select: { name: true } } } } } }, options: { orderBy: { order: "asc" } } },
  });

  const teacherRecord =
    teacherId ? await prisma.teacher.findUnique({ where: { id: teacherId }, select: { name: true } }) : null;
  await createAuditLog({
    entityType: "CourseLessonExercise",
    entityId: exerciseId,
    action: "UPDATE",
    diff: {
      lessonId,
      courseId,
      courseName: exercise?.lesson?.module?.course?.name,
      question: parsed.data.question.trim(),
      performedByRole: user.role,
      performedByUserName: user.name,
      ...(teacherId && { teacherId, teacherName: teacherRecord?.name ?? "Professor" }),
    },
    performedByUserId: user.id,
  });

  return jsonOk({
    id: exercise!.id,
    lessonId: exercise!.lessonId,
    order: exercise!.order,
    question: exercise!.question,
    options: exercise!.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, order: o.order })),
  });
}

/** Exclui exercício (admin ou professor do curso). */
export async function DELETE(_request: Request, context: Ctx) {
  const { id: courseId, moduleId, lessonId, exerciseId } = await context.params;

  const access = await requireCourseEditAccess(courseId);
  if ("err" in access) return access.err;
  const { user, teacherId } = access;

  const existing = await getExerciseAndCheck(courseId, moduleId, lessonId, exerciseId);
  if (!existing) return jsonErr("NOT_FOUND", "Exercício não encontrado.", 404);

  await prisma.courseLessonExercise.delete({ where: { id: exerciseId } });

  const teacherRecord =
    teacherId ? await prisma.teacher.findUnique({ where: { id: teacherId }, select: { name: true } }) : null;
  await createAuditLog({
    entityType: "CourseLessonExercise",
    entityId: exerciseId,
    action: "DELETE",
    diff: {
      lessonId,
      courseId,
      question: existing.question,
      performedByRole: user.role,
      performedByUserName: user.name,
      ...(teacherId && { teacherId, teacherName: teacherRecord?.name ?? "Professor" }),
    },
    performedByUserId: user.id,
  });

  return jsonOk({ deleted: true });
}
