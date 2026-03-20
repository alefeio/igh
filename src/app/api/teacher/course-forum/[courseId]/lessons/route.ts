import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";

async function assertTeacherTeachesCourse(userId: string, courseId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return null;
  const cg = await prisma.classGroup.findFirst({
    where: { teacherId: teacher.id, courseId },
    select: { id: true },
  });
  if (!cg) return null;
  return teacher;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string }> }
) {
  const user = await requireRole("TEACHER");
  const { courseId } = await context.params;

  const ok = await assertTeacherTeachesCourse(user.id, courseId);
  if (!ok) return jsonErr("FORBIDDEN", "Você não leciona este curso.", 403);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { name: true },
  });
  if (!course) return jsonErr("NOT_FOUND", "Curso não encontrado.", 404);

  const modules = await getModulesWithLessonsByCourseId(courseId);
  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

  if (lessonIds.length === 0) {
    return jsonOk({ courseName: course.name, lessons: [] });
  }

  const counts = await prisma.enrollmentLessonQuestion.groupBy({
    by: ["lessonId"],
    where: { lessonId: { in: lessonIds } },
    _count: { id: true },
    _max: { updatedAt: true },
  });
  const countMap = new Map(counts.map((c) => [c.lessonId, { n: c._count.id, at: c._max.updatedAt }]));

  const lessons = modules.flatMap((m) =>
    m.lessons.map((l) => {
      const c = countMap.get(l.id);
      return {
        lessonId: l.id,
        title: l.title,
        moduleTitle: m.title,
        moduleOrder: m.order,
        lessonOrder: l.order,
        topicCount: c?.n ?? 0,
        lastActivity: c?.at?.toISOString() ?? null,
      };
    })
  );

  lessons.sort((a, b) => {
    if (a.moduleOrder !== b.moduleOrder) return a.moduleOrder - b.moduleOrder;
    return a.lessonOrder - b.lessonOrder;
  });

  return jsonOk({ courseName: course.name, lessons });
}
