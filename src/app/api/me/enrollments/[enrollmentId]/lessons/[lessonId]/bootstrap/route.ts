import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesOutlineByCourseId } from "@/lib/course-modules";
import { unstable_cache } from "next/cache";
import { STUDENT_CONTENT_ENROLLMENT_STATUSES } from "@/lib/student-enrollment-access";
import { getLiberatedLessonIdsForEnrollment } from "@/lib/student-lesson-liberation";

export const dynamic = "force-dynamic";

type ProgressPayload = {
  completed: boolean;
  percentWatched: number;
  percentRead: number;
  completedAt: string | null;
  lastAccessedAt: string | null;
  totalMinutesStudied: number;
  lastContentPageIndex: number | null;
};

function emptyProgress(): ProgressPayload {
  return {
    completed: false,
    percentWatched: 0,
    percentRead: 0,
    completedAt: null,
    lastAccessedAt: null,
    totalMinutesStudied: 0,
    lastContentPageIndex: null,
  };
}

function toProgressPayload(row: {
  completed: boolean;
  percentWatched: number;
  percentRead: number;
  completedAt: Date | null;
  lastAccessedAt: Date | null;
  totalMinutesStudied: number;
  lastContentPageIndex: number | null;
} | null): ProgressPayload {
  if (!row) return emptyProgress();
  return {
    completed: row.completed,
    percentWatched: Math.min(100, Math.max(0, row.percentWatched)),
    percentRead: Math.min(100, Math.max(0, row.percentRead)),
    completedAt: row.completedAt?.toISOString() ?? null,
    lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
    totalMinutesStudied: row.totalMinutesStudied ?? 0,
    lastContentPageIndex: row.lastContentPageIndex ?? null,
  };
}

/** Verifica se todos os exercícios das aulas indicadas foram respondidos (sem carregar enunciados). */
async function exercisesCompleteByLessonId(
  enrollmentId: string,
  lessonIds: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  for (const id of lessonIds) result.set(id, true);
  if (lessonIds.length === 0) return result;

  const exercises = await prisma.courseLessonExercise.findMany({
    where: { lessonId: { in: lessonIds } },
    select: { id: true, lessonId: true },
  });
  if (exercises.length === 0) return result;

  const exIdsByLesson = new Map<string, string[]>();
  for (const id of lessonIds) exIdsByLesson.set(id, []);
  for (const ex of exercises) {
    exIdsByLesson.get(ex.lessonId)?.push(ex.id);
  }

  const answers = await prisma.enrollmentLessonExerciseAnswer.findMany({
    where: {
      enrollmentId,
      exerciseId: { in: exercises.map((e) => e.id) },
    },
    select: { exerciseId: true },
  });
  const answered = new Set(answers.map((a) => a.exerciseId));

  for (const [lessonId, exIds] of exIdsByLesson) {
    result.set(lessonId, exIds.length === 0 || exIds.every((id) => answered.has(id)));
  }
  return result;
}

/**
 * Bootstrap da página da aula: outline leve + detalhes da aula + progresso + favorito
 * + status de exercícios (atual/anterior), em uma única requisição.
 */
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
    where: {
      id: enrollmentId,
      studentId: student.id,
      status: { in: [...STUDENT_CONTENT_ENROLLMENT_STATUSES] },
    },
    select: {
      id: true,
      status: true,
      classGroup: {
        select: {
          id: true,
          status: true,
          endDate: true,
          courseId: true,
          course: { select: { name: true, imageUrl: true } },
        },
      },
    },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  const cg = enrollment.classGroup;
  const courseId = cg.courseId;

  const getModulesCached = unstable_cache(
    async (cid: string) => getModulesOutlineByCourseId(cid),
    ["course-outline-modules-light"],
    { revalidate: 300 }
  );

  const [liberadaLessonIds, modules, lesson] = await Promise.all([
    getLiberatedLessonIdsForEnrollment({
      enrollmentId: enrollment.id,
      enrollmentStatus: enrollment.status,
      classGroupId: cg.id,
      classGroupStatus: cg.status,
      classGroupEndDate: cg.endDate,
      courseId,
    }),
    getModulesCached(courseId),
    prisma.courseLesson.findFirst({
      where: { id: lessonId, module: { courseId } },
      select: {
        id: true,
        title: true,
        order: true,
        durationMinutes: true,
        videoUrl: true,
        contentRich: true,
        summary: true,
        imageUrls: true,
        pdfUrl: true,
        attachmentUrls: true,
        attachmentNames: true,
      },
    }),
  ]);

  if (!lesson) return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);

  const isLiberada = liberadaLessonIds.has(lessonId);

  const orderedLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const currentIndex = orderedLessonIds.indexOf(lessonId);
  const prevLessonId = currentIndex > 0 ? orderedLessonIds[currentIndex - 1]! : null;

  const now = new Date();
  const lessonIdsForProgress = orderedLessonIds;
  const lessonIdsForExercises = [lessonId, ...(prevLessonId ? [prevLessonId] : [])];

  const [progressList, favoriteRow, exerciseCompleteMap, progressTouched] = await Promise.all([
    prisma.enrollmentLessonProgress.findMany({
      where: { enrollmentId, lessonId: { in: lessonIdsForProgress } },
      select: { lessonId: true, completed: true, lastContentPageIndex: true },
    }),
    prisma.enrollmentLessonFavorite.findUnique({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      select: { id: true },
    }),
    exercisesCompleteByLessonId(enrollmentId, lessonIdsForExercises),
    isLiberada
      ? prisma.enrollmentLessonProgress.upsert({
          where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
          create: {
            enrollmentId,
            lessonId,
            completed: false,
            percentWatched: 0,
            percentRead: 0,
            completedAt: null,
            lastAccessedAt: now,
            totalMinutesStudied: 0,
            lastContentPageIndex: null,
            updatedAt: now,
          },
          update: { lastAccessedAt: now, updatedAt: now },
        })
      : prisma.enrollmentLessonProgress.findUnique({
          where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
        }),
  ]);

  const completedByLessonId = new Map(progressList.map((p) => [p.lessonId, p.completed]));
  const lastPageByLessonId = new Map(
    progressList
      .filter((p) => p.lastContentPageIndex != null)
      .map((p) => [p.lessonId, p.lastContentPageIndex as number])
  );

  // Preferir o progresso tocado (com lastAccessedAt atualizado) para a aula atual.
  if (progressTouched) {
    completedByLessonId.set(lessonId, progressTouched.completed);
    if (progressTouched.lastContentPageIndex != null) {
      lastPageByLessonId.set(lessonId, progressTouched.lastContentPageIndex);
    }
  }

  const modulesOutline = modules.map((mod) => ({
    id: mod.id,
    title: mod.title,
    description: mod.description,
    order: mod.order,
    lessons: mod.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      order: l.order,
      durationMinutes: l.durationMinutes,
      videoUrl: l.videoUrl ?? null,
      isLiberada: liberadaLessonIds.has(l.id),
      completed: completedByLessonId.get(l.id) ?? false,
      lastContentPageIndex: lastPageByLessonId.get(l.id) ?? null,
    })),
  }));

  return jsonOk({
    courseName: cg.course.name,
    modules: modulesOutline,
    lesson: {
      ...lesson,
      isLiberada,
    },
    progress: toProgressPayload(progressTouched),
    favorite: !!favoriteRow,
    currentLessonExercisesComplete: exerciseCompleteMap.get(lessonId) ?? true,
    prevLessonExercisesComplete: prevLessonId
      ? (exerciseCompleteMap.get(prevLessonId) ?? true)
      : true,
  });
}
