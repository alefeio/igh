import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Cursos distintos em que o professor tem turma (para o fórum por curso). */
export async function GET() {
  const user = await requireRole("TEACHER");

  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return jsonErr("NOT_FOUND", "Professor não encontrado.", 404);

  const groups = await prisma.classGroup.findMany({
    where: { teacherId: teacher.id },
    select: {
      courseId: true,
      course: { select: { name: true } },
    },
  });

  const byCourse = new Map<string, string>();
  for (const g of groups) {
    if (!byCourse.has(g.courseId)) byCourse.set(g.courseId, g.course.name);
  }

  const courseIdList = Array.from(byCourse.keys());
  const topicCountByCourse = new Map<string, number>();
  for (const cid of courseIdList) topicCountByCourse.set(cid, 0);

  if (courseIdList.length > 0) {
    const lessonsWithCourse = await prisma.courseLesson.findMany({
      where: { module: { courseId: { in: courseIdList } } },
      select: { id: true, module: { select: { courseId: true } } },
    });
    const allLessonIds = lessonsWithCourse.map((l) => l.id);
    if (allLessonIds.length > 0) {
      const grouped = await prisma.enrollmentLessonQuestion.groupBy({
        by: ["lessonId"],
        where: { lessonId: { in: allLessonIds } },
        _count: { id: true },
      });
      const countByLesson = new Map(grouped.map((g) => [g.lessonId, g._count.id]));
      for (const row of lessonsWithCourse) {
        const n = countByLesson.get(row.id) ?? 0;
        const cid = row.module.courseId;
        topicCountByCourse.set(cid, (topicCountByCourse.get(cid) ?? 0) + n);
      }
    }
  }

  const courses: {
    courseId: string;
    courseName: string;
    topicCount: number;
    classGroupsCount: number;
  }[] = [];

  for (const [courseId, courseName] of byCourse) {
    const classGroupsCount = groups.filter((g) => g.courseId === courseId).length;
    courses.push({
      courseId,
      courseName,
      topicCount: topicCountByCourse.get(courseId) ?? 0,
      classGroupsCount,
    });
  }

  courses.sort((a, b) => a.courseName.localeCompare(b.courseName, "pt-BR"));

  return jsonOk({ courses });
}
