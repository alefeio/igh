import { prisma } from "@/lib/prisma";
import { requireStaffRead } from "@/lib/auth";
import { mapStaffOrTeacherReplyName } from "@/lib/course-forum-reply-display";
import { jsonErr, jsonOk } from "@/lib/http";

/** Leitura do fórum da aula (admin) — mesmo conteúdo que o professor vê, sem exigir vínculo com turma. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  await requireStaffRead();
  const { courseId, lessonId } = await context.params;

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
        include: {
          teacher: { select: { name: true } },
          staffUser: { select: { name: true } },
        },
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
        teacherName: mapStaffOrTeacherReplyName(r),
      })),
    })),
  });
}
