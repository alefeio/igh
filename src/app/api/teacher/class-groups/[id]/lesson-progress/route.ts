import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Lista progresso de aulas (assistidas e concluídas) por aluno da turma. Apenas professor dono da turma. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const cg = await prisma.classGroup.findUnique({
    where: { id: classGroupId, teacherId: teacher.id },
    select: { id: true, courseId: true },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

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
