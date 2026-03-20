import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Cursos em que o aluno está matriculado (ativo), com contagem de tópicos no fórum do curso (todas as turmas). */
export async function GET() {
  const user = await requireRole("STUDENT");

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    orderBy: { enrolledAt: "asc" },
    include: {
      classGroup: {
        select: {
          courseId: true,
          course: { select: { id: true, name: true } },
        },
      },
    },
  });

  type CourseRow = {
    courseId: string;
    courseName: string;
    primaryEnrollmentId: string;
    topicCount: number;
    enrollmentCount: number;
  };

  const byCourse = new Map<string, { courseName: string; primaryEnrollmentId: string; enrollmentCount: number }>();
  for (const e of enrollments) {
    const cid = e.classGroup.courseId;
    const existing = byCourse.get(cid);
    if (!existing) {
      byCourse.set(cid, {
        courseName: e.classGroup.course.name,
        primaryEnrollmentId: e.id,
        enrollmentCount: 1,
      });
    } else {
      existing.enrollmentCount += 1;
    }
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

  const courses: CourseRow[] = [];
  for (const [courseId, meta] of byCourse) {
    courses.push({
      courseId,
      courseName: meta.courseName,
      primaryEnrollmentId: meta.primaryEnrollmentId,
      topicCount: topicCountByCourse.get(courseId) ?? 0,
      enrollmentCount: meta.enrollmentCount,
    });
  }

  courses.sort((a, b) => a.courseName.localeCompare(b.courseName, "pt-BR"));

  return jsonOk({ courses });
}
