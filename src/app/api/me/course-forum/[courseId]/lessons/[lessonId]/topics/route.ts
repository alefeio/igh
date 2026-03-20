import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getLiberadaLessonIdsForEnrollment } from "@/lib/course-forum";

/**
 * Tópicos do fórum da aula (todos os alunos do curso).
 * Leitura permitida mesmo se a aula ainda não estiver liberada no cronograma da turma;
 * `canParticipate` indica se o aluno pode criar tópicos/respostas (regra das aulas liberadas).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { courseId, lessonId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

  const primaryEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, status: "ACTIVE", classGroup: { courseId } },
    orderBy: { enrolledAt: "asc" },
    include: {
      classGroup: {
        include: {
          sessions: {
            where: { status: "LIBERADA" },
            orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
            select: { lessonId: true, status: true },
          },
        },
      },
    },
  });
  if (!primaryEnrollment) return jsonErr("FORBIDDEN", "Você não está matriculado neste curso.", 403);

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, module: { courseId } },
    select: { id: true, title: true, module: { select: { title: true } } },
  });
  if (!lesson) return jsonErr("NOT_FOUND", "Aula não encontrada neste curso.", 404);

  const liberadaIds = await getLiberadaLessonIdsForEnrollment(primaryEnrollment);
  const canParticipate = liberadaIds.has(lessonId);

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
    primaryEnrollmentId: primaryEnrollment.id,
    canParticipate,
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
