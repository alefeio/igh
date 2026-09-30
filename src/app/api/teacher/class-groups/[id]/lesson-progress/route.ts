import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireReadableClassGroup } from "@/lib/teacher-class-group-access";

/** Lista progresso de aulas (assistidas e concluídas) por aluno da turma. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: classGroupId } = await context.params;
  const access = await requireReadableClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const cg = access.classGroup;

  const enrollments = await prisma.enrollment.findMany({
    where: { classGroupId, status: "ACTIVE" },
    select: {
      id: true,
      student: { select: { id: true, name: true } },
    },
  });

  if (enrollments.length === 0) {
    return jsonOk({ byEnrollment: [] });
  }

  const enrollmentIds = enrollments.map((e) => e.id);

  const progressList = await prisma.enrollmentLessonProgress.findMany({
    where: {
      enrollmentId: { in: enrollmentIds },
      lesson: { module: { courseId: cg.courseId } },
    },
    select: {
      enrollmentId: true,
      lessonId: true,
      completed: true,
      completedAt: true,
      lastAccessedAt: true,
      totalMinutesStudied: true,
      percentWatched: true,
      percentRead: true,
      lesson: {
        select: {
          id: true,
          title: true,
          order: true,
          module: { select: { order: true, title: true } },
        },
      },
    },
  });

  const byEnrollment = enrollments.map((enr) => {
    const list = progressList
      .filter((p) => p.enrollmentId === enr.id)
      .sort(
        (a, b) =>
          a.lesson.module.order - b.lesson.module.order ||
          a.lesson.order - b.lesson.order
      );
    return {
      enrollmentId: enr.id,
      studentName: enr.student.name,
      studentId: enr.student.id,
      progress: list.map((p) => ({
        lessonId: p.lessonId,
        lessonTitle: p.lesson.title,
        moduleTitle: p.lesson.module.title,
        completed: p.completed,
        completedAt: p.completedAt,
        lastAccessedAt: p.lastAccessedAt,
        totalMinutesStudied: p.totalMinutesStudied,
        percentWatched: p.percentWatched,
        percentRead: p.percentRead,
      })),
    };
  });

  return jsonOk({ byEnrollment });
}
