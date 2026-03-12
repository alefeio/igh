import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Lista exercícios realizados pelos alunos da turma (respostas por matrícula/aula). Apenas professor dono da turma. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const cg = await prisma.classGroup.findUnique({
    where: { id: classGroupId, teacherId: teacher.id },
    select: { id: true },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const enrollmentIds = await prisma.enrollment
    .findMany({
      where: { classGroupId, status: "ACTIVE" },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  if (enrollmentIds.length === 0) {
    return jsonOk({ byEnrollment: [], byLesson: [] });
  }

  const answers = await prisma.enrollmentLessonExerciseAnswer.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      enrollmentId: true,
      exerciseId: true,
      selectedOptionId: true,
      correct: true,
      createdAt: true,
      enrollment: {
        select: {
          id: true,
          student: { select: { id: true, name: true } },
        },
      },
      exercise: {
        select: {
          id: true,
          question: true,
          lessonId: true,
          lesson: { select: { id: true, title: true, order: true } },
        },
      },
    },
  });

  const byEnrollment = enrollmentIds.map((eid) => {
    const list = answers.filter((a) => a.enrollmentId === eid);
    const first = list[0];
    return {
      enrollmentId: eid,
      studentName: first?.enrollment.student.name ?? "",
      studentId: first?.enrollment.student.id ?? "",
      answers: list.map((a, index) => ({
        id: a.id,
        exerciseId: a.exerciseId,
        question: a.exercise.question,
        lessonId: a.exercise.lessonId,
        lessonTitle: a.exercise.lesson.title,
        correct: a.correct,
        createdAt: a.createdAt,
        attemptIndex: index + 1,
        totalAttemptsForExercise: list.filter((b) => b.exerciseId === a.exerciseId).length,
      })),
      totalCorrect: list.filter((a) => a.correct).length,
      totalAttempts: list.length,
    };
  });

  return jsonOk({
    byEnrollment: byEnrollment.filter((e) => e.answers.length > 0),
  });
}
