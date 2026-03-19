import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

async function assertTeacherOwnsClassGroup(userId: string, classGroupId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return null;
  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId, teacherId: teacher.id },
    select: { courseId: true, course: { select: { name: true } } },
  });
  if (!cg) return null;
  return { teacher, courseId: cg.courseId, courseName: cg.course.name };
}

/** Lista dúvidas do curso da turma (para o professor responder). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;
  const ctx = await assertTeacherOwnsClassGroup(user.id, classGroupId);
  if (!ctx) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const lessonIds = (
    await prisma.courseLesson.findMany({
      where: { module: { courseId: ctx.courseId } },
      select: { id: true, title: true, order: true, module: { select: { order: true, title: true } } },
    })
  ).sort((a, b) => {
    const mo = a.module.order - b.module.order;
    if (mo !== 0) return mo;
    return a.order - b.order;
  });

  const ids = lessonIds.map((l) => l.id);
  if (ids.length === 0) return jsonOk({ questions: [], courseName: ctx.courseName });

  const questions = await prisma.enrollmentLessonQuestion.findMany({
    where: { lessonId: { in: ids } },
    orderBy: { updatedAt: "desc" },
    take: 300,
    include: {
      enrollment: { select: { student: { select: { name: true } } } },
      teacherReplies: {
        orderBy: { createdAt: "asc" },
        include: { teacher: { select: { name: true } } },
      },
    },
  });

  const lessonMeta = new Map(lessonIds.map((l) => [l.id, l]));

  return jsonOk({
    courseName: ctx.courseName,
    questions: questions.map((q) => {
      const les = lessonMeta.get(q.lessonId);
      return {
        id: q.id,
        lessonId: q.lessonId,
        lessonTitle: les?.title ?? "Aula",
        moduleTitle: les?.module.title ?? "",
        content: q.content,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
        authorName: q.enrollment.student.name,
        teacherReplies: q.teacherReplies.map((r) => ({
          id: r.id,
          content: r.content,
          createdAt: r.createdAt.toISOString(),
          teacherName: r.teacher.name,
        })),
      };
    }),
  });
}
