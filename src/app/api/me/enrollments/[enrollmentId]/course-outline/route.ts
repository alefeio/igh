import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getCourseLessonIdsInOrder, getModulesWithLessonsByCourseId } from "@/lib/course-modules";
import { getEndOfTodayBrazil } from "@/lib/brazil-today";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

type OutlineLesson = {
  id: string;
  title: string;
  order: number;
  durationMinutes: number | null;
  videoUrl: string | null;
  isLiberada: boolean;
  completed: boolean;
  lastContentPageIndex: number | null;
};

type OutlineModule = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: OutlineLesson[];
};

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
  if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    select: {
      id: true,
      classGroup: {
        select: {
          id: true,
          courseId: true,
          course: { select: { name: true, imageUrl: true } },
          teacher: { select: { name: true, photoUrl: true } },
        },
      },
    },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  // Liberação automática (mantém comportamento atual), mas sem refetch duplicado de enrollment.
  const endOfTodayBrazil = getEndOfTodayBrazil();
  await prisma.classSession.updateMany({
    where: {
      classGroupId: enrollment.classGroup.id,
      status: "SCHEDULED",
      sessionDate: { lte: endOfTodayBrazil },
    },
    data: { status: "LIBERADA" },
  });

  const courseId = enrollment.classGroup.courseId;

  const liberadaSessionsOrdered = await prisma.classSession.findMany({
    where: { classGroupId: enrollment.classGroup.id, status: "LIBERADA" },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    select: { lessonId: true },
  });
  const courseLessonIdsInOrder = await getCourseLessonIdsInOrder(courseId);

  const liberadaLessonIds = new Set<string>();
  liberadaSessionsOrdered.forEach((session, index) => {
    if (session.lessonId) liberadaLessonIds.add(session.lessonId);
    else if (courseLessonIdsInOrder[index]) liberadaLessonIds.add(courseLessonIdsInOrder[index]);
  });

  const getModulesCached = unstable_cache(
    async (cid: string) => getModulesWithLessonsByCourseId(cid),
    ["course-outline-modules"],
    { revalidate: 300 }
  );
  const modules = await getModulesCached(courseId);

  const courseImageUrl = resolveCourseImageUrl(enrollment.classGroup.course.imageUrl ?? null, modules);

  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const progressList = await prisma.enrollmentLessonProgress.findMany({
    where: { enrollmentId, lessonId: { in: lessonIds } },
    select: { lessonId: true, completed: true, lastContentPageIndex: true },
  });
  const completedByLessonId = new Map(progressList.map((p) => [p.lessonId, p.completed]));
  const lastContentPageIndexByLessonId = new Map(
    progressList
      .filter((p) => p.lastContentPageIndex != null)
      .map((p) => [p.lessonId, p.lastContentPageIndex as number])
  );

  const modulesOutline: OutlineModule[] = modules.map((mod) => ({
    id: mod.id,
    title: mod.title,
    description: mod.description,
    order: mod.order,
    lessons: mod.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      order: lesson.order,
      durationMinutes: lesson.durationMinutes,
      videoUrl: lesson.videoUrl ?? null,
      isLiberada: liberadaLessonIds.has(lesson.id),
      completed: completedByLessonId.get(lesson.id) ?? false,
      lastContentPageIndex: lastContentPageIndexByLessonId.get(lesson.id) ?? null,
    })),
  }));

  const t = enrollment.classGroup.teacher;
  return jsonOk({
    courseName: enrollment.classGroup.course.name,
    courseImageUrl,
    teacherName: t?.name ?? "",
    teacherPhotoUrl: t?.photoUrl ?? null,
    modules: modulesOutline,
  });
}

