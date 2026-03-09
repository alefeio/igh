import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";

/** Dashboard da turma: progresso e desempenho nos exercícios por aula/módulo. Sempre retorna JSON. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const user = await requireRole("STUDENT");
    const { enrollmentId } = await context.params;

    const student = await prisma.student.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
      include: {
        classGroup: { select: { courseId: true } },
      },
    });
    if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

    const courseId = enrollment.classGroup.courseId;
    const modules = await getModulesWithLessonsByCourseId(courseId);
    const totalLessons = modules.reduce((acc, m) => acc + (m.lessons?.length ?? 0), 0);

    const progressList = await prisma.enrollmentLessonProgress.findMany({
      where: { enrollmentId, completed: true },
      select: { lessonId: true },
    });
    const completedCount = progressList.length;

    const answers = await prisma.enrollmentLessonExerciseAnswer.findMany({
      where: { enrollmentId },
      select: {
        exerciseId: true,
        correct: true,
        createdAt: true,
        exercise: {
          select: {
            lessonId: true,
            lesson: {
              select: {
                id: true,
                title: true,
                moduleId: true,
                module: { select: { id: true, title: true, order: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const byLesson = new Map<
      string,
      { lessonId: string; lessonTitle: string; moduleTitle: string; moduleOrder: number; attempts: { correct: boolean }[] }
    >();
    for (const a of answers) {
      if (!a.exercise?.lesson) continue;
      const { lesson } = a.exercise;
      const key = lesson.id;
      if (!byLesson.has(key)) {
        byLesson.set(key, {
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          moduleTitle: lesson.module.title,
          moduleOrder: lesson.module.order,
          attempts: [],
        });
      }
      byLesson.get(key)!.attempts.push({ correct: a.correct });
    }

    const lessonStats = Array.from(byLesson.values()).map((l) => {
      const total = l.attempts.length;
      const correct = l.attempts.filter((x) => x.correct).length;
      const lastCorrect = total > 0 ? l.attempts[l.attempts.length - 1].correct : null;
      return {
        lessonId: l.lessonId,
        lessonTitle: l.lessonTitle,
        moduleTitle: l.moduleTitle,
        moduleOrder: l.moduleOrder,
        totalAttempts: total,
        correctAttempts: correct,
        lastAttemptCorrect: lastCorrect,
        ratio: total > 0 ? correct / total : 0,
      };
    });

    const thresholdBem = 0.7;
    const thresholdAtencao = 0.5;
    const topicsBem = lessonStats.filter((s) => s.totalAttempts > 0 && s.ratio >= thresholdBem);
    const topicsAtencao = lessonStats.filter((s) => s.totalAttempts > 0 && s.ratio < thresholdAtencao);

    const completedLessonIds = new Set(progressList.map((p) => p.lessonId));
    const allLessonsOrdered = modules.flatMap((m) => (m.lessons ?? []).map((l) => ({ id: l.id, title: l.title })));
    const recommendedLesson = allLessonsOrdered.find((l) => !completedLessonIds.has(l.id)) ?? null;

    return jsonOk({
      progress: { completed: completedCount, total: totalLessons },
      recommendedLesson: recommendedLesson ? { id: recommendedLesson.id, title: recommendedLesson.title } : null,
      lessonStats,
      topicsBem,
      topicsAtencao,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao carregar o dashboard.";
    return jsonErr("INTERNAL_ERROR", message, 500);
  }
}
