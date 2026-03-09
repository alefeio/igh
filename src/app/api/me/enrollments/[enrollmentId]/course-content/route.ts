import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId, getCourseLessonIdsInOrder } from "@/lib/course-modules";

/** Conteúdo do curso por módulos e aulas; marca quais aulas estão liberadas para esta matrícula. Apenas STUDENT. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    include: {
      classGroup: {
        include: {
          course: { select: { id: true, name: true } },
          sessions: {
            where: { status: "LIBERADA" },
            orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
            select: { lessonId: true },
          },
        },
      },
    },
  });

  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const courseId = enrollment.classGroup.courseId;
  const liberadaSessionsOrdered = enrollment.classGroup.sessions;
  const courseLessonIdsInOrder = await getCourseLessonIdsInOrder(courseId);

  const liberadaLessonIds = new Set<string>();
  liberadaSessionsOrdered.forEach((session, index) => {
    if (session.lessonId) {
      liberadaLessonIds.add(session.lessonId);
    } else if (courseLessonIdsInOrder[index]) {
      liberadaLessonIds.add(courseLessonIdsInOrder[index]);
    }
  });

  const modules = await getModulesWithLessonsByCourseId(courseId);

  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const [progressList, answers] = await Promise.all([
    prisma.enrollmentLessonProgress.findMany({
      where: { enrollmentId, lessonId: { in: lessonIds } },
      select: { lessonId: true, completed: true },
    }),
    prisma.enrollmentLessonExerciseAnswer.findMany({
      where: { enrollmentId },
      select: {
        correct: true,
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
    }),
  ]);
  const completedByLessonId = new Map(progressList.map((p) => [p.lessonId, p.completed]));

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
  const totalCorrect = lessonStats.reduce((s, l) => s + l.correctAttempts, 0);
  const totalAttempts = lessonStats.reduce((s, l) => s + l.totalAttempts, 0);

  const modulesWithLiberada = modules.map((mod) => ({
    id: mod.id,
    title: mod.title,
    description: mod.description,
    order: mod.order,
    lessons: mod.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      order: lesson.order,
      durationMinutes: lesson.durationMinutes,
      videoUrl: lesson.videoUrl,
      contentRich: lesson.contentRich,
      summary: lesson.summary,
      imageUrls: lesson.imageUrls ?? [],
      pdfUrl: lesson.pdfUrl,
      attachmentUrls: lesson.attachmentUrls ?? [],
      isLiberada: liberadaLessonIds.has(lesson.id),
      completed: completedByLessonId.get(lesson.id) ?? false,
    })),
  }));

  return jsonOk({
    courseName: enrollment.classGroup.course.name,
    modules: modulesWithLiberada,
    exerciseStats: {
      totalCorrect,
      totalAttempts,
      lessonStats,
      topicsBem,
      topicsAtencao,
    },
  });
}
