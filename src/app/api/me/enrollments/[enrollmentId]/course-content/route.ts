import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId, getCourseLessonIdsInOrder } from "@/lib/course-modules";
import { getEndOfTodayBrazil } from "@/lib/brazil-today";

export const dynamic = "force-dynamic";

/** Foto do curso: URL do cadastro; se vazio, primeira imagem de alguma aula (como na prática muitos cursos usam). */
function resolveCourseImageUrl(
  courseImageUrl: string | null | undefined,
  modules: Awaited<ReturnType<typeof getModulesWithLessonsByCourseId>>
): string | null {
  const u = courseImageUrl?.trim();
  if (u) return u;
  for (const mod of modules) {
    for (const les of mod.lessons) {
      for (const url of les.imageUrls ?? []) {
        const t = url?.trim();
        if (t) return t;
      }
    }
  }
  return null;
}

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
          course: { select: { id: true, name: true, imageUrl: true } },
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

  const endOfTodayBrazil = getEndOfTodayBrazil();
  await prisma.classSession.updateMany({
    where: {
      classGroupId: enrollment.classGroup.id,
      status: "SCHEDULED",
      sessionDate: { lte: endOfTodayBrazil },
    },
    data: { status: "LIBERADA" },
  });

  const enrollmentAfterUpdate = await prisma.enrollment.findFirst({
    where: { id: enrollmentId },
    include: {
      classGroup: {
        include: {
          course: { select: { id: true, name: true, imageUrl: true } },
          teacher: { select: { name: true, photoUrl: true } },
          sessions: {
            where: { status: "LIBERADA" },
            orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
            select: { lessonId: true },
          },
        },
      },
    },
  });

  if (!enrollmentAfterUpdate) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const courseId = enrollmentAfterUpdate.classGroup.courseId;
  const liberadaSessionsOrdered = enrollmentAfterUpdate.classGroup.sessions;
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

  const courseRow = await prisma.course.findUnique({
    where: { id: courseId },
    select: { imageUrl: true },
  });
  const courseImageUrl = resolveCourseImageUrl(courseRow?.imageUrl ?? null, modules);

  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const orderedLessons = modules.flatMap((m) => m.lessons);
  const [progressList, answers, exerciseCountByLesson] = await Promise.all([
    prisma.enrollmentLessonProgress.findMany({
      where: { enrollmentId, lessonId: { in: lessonIds } },
      select: { lessonId: true, completed: true, lastContentPageIndex: true },
    }),
    prisma.enrollmentLessonExerciseAnswer.findMany({
      where: { enrollmentId },
      select: {
        correct: true,
        exerciseId: true,
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
    prisma.courseLessonExercise.groupBy({
      by: ["lessonId"],
      where: { lessonId: { in: lessonIds } },
      _count: { id: true },
    }),
  ]);
  const exerciseCountMap = new Map(
    exerciseCountByLesson.map((g) => [g.lessonId, g._count.id])
  );
  const answeredExerciseIdsByLesson = new Map<string, Set<string>>();
  for (const a of answers) {
    const lid = a.exercise?.lesson?.id;
    if (!lid) continue;
    if (!answeredExerciseIdsByLesson.has(lid)) {
      answeredExerciseIdsByLesson.set(lid, new Set());
    }
    answeredExerciseIdsByLesson.get(lid)!.add(a.exerciseId);
  }
  const previousLessonExercisesCompleteByLessonId = new Map<string, boolean>();
  for (let i = 0; i < orderedLessons.length; i++) {
    const lesson = orderedLessons[i]!;
    if (i === 0) {
      previousLessonExercisesCompleteByLessonId.set(lesson.id, true);
    } else {
      const prev = orderedLessons[i - 1]!;
      const prevCount = exerciseCountMap.get(prev.id) ?? 0;
      const prevAnswered = answeredExerciseIdsByLesson.get(prev.id)?.size ?? 0;
      previousLessonExercisesCompleteByLessonId.set(
        lesson.id,
        prevCount === 0 || prevAnswered >= prevCount
      );
    }
  }
  const completedByLessonId = new Map(progressList.map((p) => [p.lessonId, p.completed]));
  const lastContentPageIndexByLessonId = new Map(
    progressList
      .filter((p) => p.lastContentPageIndex != null)
      .map((p) => [p.lessonId, p.lastContentPageIndex as number])
  );

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
      attachmentNames: lesson.attachmentNames ?? [],
      isLiberada: liberadaLessonIds.has(lesson.id),
      completed: completedByLessonId.get(lesson.id) ?? false,
      lastContentPageIndex: lastContentPageIndexByLessonId.get(lesson.id) ?? null,
      previousLessonExercisesComplete:
        previousLessonExercisesCompleteByLessonId.get(lesson.id) ?? true,
    })),
  }));

  const t = enrollmentAfterUpdate.classGroup.teacher;
  return jsonOk({
    courseName: enrollmentAfterUpdate.classGroup.course.name,
    courseImageUrl,
    teacherName: t.name,
    teacherPhotoUrl: t.photoUrl ?? null,
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
