import { prisma } from "@/lib/prisma";
import { requireStaffRead } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

/** Cursos ativos com contagem de tópicos no fórum (admin — visão global). */
export async function GET() {
  await requireStaffRead();

  const courses = await prisma.course.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (courses.length === 0) {
    return jsonOk({ courses: [] as { courseId: string; courseName: string; topicCount: number; classGroupsCount: number }[] });
  }

  const courseIds = courses.map((c) => c.id);

  const lessons = await prisma.courseLesson.findMany({
    where: { module: { courseId: { in: courseIds } } },
    select: { id: true, module: { select: { courseId: true } } },
  });
  const lessonIds = lessons.map((l) => l.id);

  const [cgGrouped, questionGrouped] = await Promise.all([
    prisma.classGroup.groupBy({
      by: ["courseId"],
      where: { courseId: { in: courseIds } },
      _count: { id: true },
    }),
    lessonIds.length > 0
      ? prisma.enrollmentLessonQuestion.groupBy({
          by: ["lessonId"],
          where: { lessonId: { in: lessonIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const cgCountByCourse = new Map(cgGrouped.map((g) => [g.courseId, g._count.id]));
  const countByLesson = new Map(questionGrouped.map((g) => [g.lessonId, g._count.id]));
  const topicByCourse = new Map<string, number>();
  for (const l of lessons) {
    const n = countByLesson.get(l.id) ?? 0;
    const cid = l.module.courseId;
    topicByCourse.set(cid, (topicByCourse.get(cid) ?? 0) + n);
  }

  const out = courses.map((c) => ({
    courseId: c.id,
    courseName: c.name,
    topicCount: topicByCourse.get(c.id) ?? 0,
    classGroupsCount: cgCountByCourse.get(c.id) ?? 0,
  }));

  return jsonOk({ courses: out });
}
