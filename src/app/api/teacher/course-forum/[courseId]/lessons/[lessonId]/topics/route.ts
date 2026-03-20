import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

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
  return true;
}

/** Tópicos da aula no fórum do curso (todos os alunos matriculados em qualquer turma do curso). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const user = await requireRole("TEACHER");
  const { courseId, lessonId } = await context.params;

  const allowed = await assertTeacherTeachesCourse(user.id, courseId);
  if (!allowed) return jsonErr("FORBIDDEN", "Você não leciona este curso.", 403);

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, module: { courseId } },
    select: { id: true, title: true, module: { select: { title: true } } },
  });
  if (!lesson) return jsonErr("NOT_FOUND", "Aula não encontrada neste curso.", 404);

  const questions = await prisma.enrollmentLessonQuestion.findMany({
    where: { lessonId },
    orderBy: { createdAt: "asc" },
    include: {
      enrollment: {
        select: { id: true, student: { select: { name: true } } },
      },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          enrollment: {
            select: { id: true, student: { select: { name: true } } },
          },
        },
      },
      teacherReplies: {
        orderBy: { createdAt: "asc" },
        include: { teacher: { select: { name: true } } },
      },
    },
  });

  return jsonOk({
    lessonTitle: lesson.title,
    moduleTitle: lesson.module.title,
    topics: questions.map((q) => ({
      id: q.id,
      content: q.content,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
      enrollmentId: q.enrollmentId,
      authorName: q.enrollment.student.name,
      replies: q.replies.map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        enrollmentId: r.enrollmentId,
        authorName: r.enrollment.student.name,
      })),
      teacherReplies: q.teacherReplies.map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        teacherName: r.teacher.name,
      })),
    })),
  });
}
