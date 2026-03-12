import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Submete resposta do aluno e retorna se acertou e qual a opção correta. */
export async function POST(
  request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string; exerciseId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId, exerciseId } = await context.params;

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

  let body: { optionId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }
  const optionId = typeof body.optionId === "string" ? body.optionId.trim() : "";
  if (!optionId) return jsonErr("BAD_REQUEST", "optionId é obrigatório.", 400);

  const option = await prisma.courseLessonExerciseOption.findFirst({
    where: { id: optionId, exerciseId },
    include: {
      exercise: { select: { lessonId: true } },
    },
  });
  if (!option || option.exercise.lessonId !== lessonId)
    return jsonErr("NOT_FOUND", "Opção não encontrada.", 404);

  const correctOption = await prisma.courseLessonExerciseOption.findFirst({
    where: { exerciseId, isCorrect: true },
    select: { id: true },
  });

  const correct = option.isCorrect;

  /** Sempre cria novo registro: mantém histórico de todas as tentativas (erradas e certas) mesmo ao refazer. */
  await prisma.enrollmentLessonExerciseAnswer.create({
    data: {
      enrollmentId,
      exerciseId,
      selectedOptionId: optionId,
      correct,
    },
  });

  return jsonOk({
    correct,
    correctOptionId: correctOption?.id ?? null,
  });
}
