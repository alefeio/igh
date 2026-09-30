import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireReadableClassGroup } from "@/lib/teacher-class-group-access";

/** Lista exercícios realizados pelos alunos da turma (respostas por matrícula/aula). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: classGroupId } = await context.params;
  const access = await requireReadableClassGroup(classGroupId);
  if ("error" in access) return access.error;

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
