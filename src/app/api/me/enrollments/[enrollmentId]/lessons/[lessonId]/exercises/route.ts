import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Lista exercícios da aula para o aluno (apenas aula liberada). Opções sem isCorrect para não revelar resposta. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    include: {
      classGroup: {
        include: {
          sessions: {
            where: { status: "LIBERADA" },
            orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
            select: { lessonId: true },
          },
        },
      },
    },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId)
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);

  const courseId = enrollment.classGroup.courseId;
  const sessions = enrollment.classGroup.sessions;
  const lessonIdsOrder = await getCourseLessonIdsInOrder(courseId);
  const liberadaIds = new Set<string>();
  sessions.forEach((s, i) => {
    if (s.lessonId) liberadaIds.add(s.lessonId);
    else if (lessonIdsOrder[i]) liberadaIds.add(lessonIdsOrder[i]);
  });
  if (!liberadaIds.has(lessonId)) return jsonErr("FORBIDDEN", "Aula não liberada.", 403);

  const exercises = await prisma.courseLessonExercise.findMany({
    where: { lessonId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      options: { orderBy: { order: "asc" }, select: { id: true, text: true, order: true } },
    },
  });

  const exerciseIds = exercises.map((ex) => ex.id);
  const answers = await prisma.enrollmentLessonExerciseAnswer.findMany({
    where: { enrollmentId, exerciseId: { in: exerciseIds } },
    select: { exerciseId: true, selectedOptionId: true, correct: true },
  });
  const correctOptionIds = await prisma.courseLessonExerciseOption.findMany({
    where: { exerciseId: { in: exerciseIds }, isCorrect: true },
    select: { exerciseId: true, id: true },
  });
  const correctOptionByExerciseId = new Map(correctOptionIds.map((o) => [o.exerciseId, o.id]));
  const answersPayload = answers.map((a) => ({
    exerciseId: a.exerciseId,
    selectedOptionId: a.selectedOptionId,
    correct: a.correct,
    correctOptionId: correctOptionByExerciseId.get(a.exerciseId) ?? null,
  }));

  return jsonOk({
    exercises: exercises.map((ex) => ({
      id: ex.id,
      order: ex.order,
      question: ex.question,
      options: ex.options.map((o) => ({ id: o.id, text: o.text, order: o.order })),
    })),
    answers: answersPayload,
  });
}
