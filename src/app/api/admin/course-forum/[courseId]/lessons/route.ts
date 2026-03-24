import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string }> }
) {
  await requireRole(["ADMIN", "MASTER"]);
  const { courseId } = await context.params;

  const course = await prisma.course.findFirst({
    where: { id: courseId, status: "ACTIVE" },
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

  const lessonRows = modules.flatMap((m) =>
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

  lessonRows.sort((a, b) => {
    if (a.moduleOrder !== b.moduleOrder) return a.moduleOrder - b.moduleOrder;
    return a.lessonOrder - b.lessonOrder;
  });

  return jsonOk({ courseName: course.name, lessons: lessonRows });
}
