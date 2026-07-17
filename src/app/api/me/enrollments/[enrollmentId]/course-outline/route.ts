import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesOutlineByCourseId } from "@/lib/course-modules";
import { unstable_cache } from "next/cache";
import {
  STUDENT_VISIBLE_ENROLLMENT_STATUSES,
} from "@/lib/student-enrollment-access";
import { getLiberatedLessonIdsForEnrollment } from "@/lib/student-lesson-liberation";

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
  modules: Awaited<ReturnType<typeof getModulesOutlineByCourseId>>
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
    where: { id: enrollmentId, studentId: student.id, status: { in: [...STUDENT_VISIBLE_ENROLLMENT_STATUSES] } },
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
          teacher: { select: { name: true, photoUrl: true } },
        },
      },
    },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  const enrollmentSuspended = enrollment.status === "SUSPENDED";
  const cg = enrollment.classGroup;
  const courseId = cg.courseId;

  const liberadaLessonIds = await getLiberatedLessonIdsForEnrollment({
    enrollmentId: enrollment.id,
    enrollmentStatus: enrollment.status,
    classGroupId: cg.id,
    classGroupStatus: cg.status,
    classGroupEndDate: cg.endDate,
    courseId,
  });

  const getModulesCached = unstable_cache(
    async (cid: string) => getModulesOutlineByCourseId(cid),
    ["course-outline-modules-light"],
    { revalidate: 300 }
  );
  const modules = await getModulesCached(courseId);

  const courseImageUrl = resolveCourseImageUrl(cg.course.imageUrl ?? null, modules);

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
      isLiberada: enrollmentSuspended ? false : liberadaLessonIds.has(lesson.id),
      completed: completedByLessonId.get(lesson.id) ?? false,
      lastContentPageIndex: lastContentPageIndexByLessonId.get(lesson.id) ?? null,
    })),
  }));

  const t = enrollment.classGroup.teacher;
  return jsonOk({
    enrollmentSuspended,
    courseName: enrollment.classGroup.course.name,
    courseImageUrl,
    teacherName: t?.name ?? "",
    teacherPhotoUrl: t?.photoUrl ?? null,
    modules: modulesOutline,
  });
}
