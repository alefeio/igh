import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

async function getOwnStudentReply(
  userId: string,
  enrollmentId: string,
  lessonId: string,
  questionId: string,
  replyId: string
) {
  const student = await prisma.student.findFirst({
    where: { userId },
    select: { id: true, name: true },
  });
  if (!student) return null;

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: { in: ["ACTIVE", "COMPLETED"] } },
    select: { id: true, classGroup: { select: { courseId: true } } },
  });
  if (!enrollment) return null;

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, module: { courseId: enrollment.classGroup.courseId } },
    select: { id: true },
  });
  if (!lesson) return null;

  const question = await prisma.enrollmentLessonQuestion.findFirst({
    where: { id: questionId, lessonId },
    select: { id: true },
  });
  if (!question) return null;

  const reply = await prisma.enrollmentLessonQuestionReply.findFirst({
    where: {
      id: replyId,
      questionId: question.id,
      enrollmentId,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      enrollmentId: true,
    },
  });
  if (!reply) return null;

  return { student, reply };
}

/** Atualiza resposta própria do aluno no fórum da aula. */
export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      enrollmentId: string;
      lessonId: string;
      questionId: string;
      replyId: string;
    }>;
  }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId, questionId, replyId } = await context.params;

  const owned = await getOwnStudentReply(user.id, enrollmentId, lessonId, questionId, replyId);
  if (!owned) {
    return jsonErr("NOT_FOUND", "Resposta não encontrada ou você não pode editá-la.", 404);
  }

  let body: { content?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return jsonErr("BAD_REQUEST", "Digite sua resposta.", 400);

  const updated = await prisma.enrollmentLessonQuestionReply.update({
    where: { id: replyId },
    data: { content },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      enrollmentId: true,
    },
  });

  return jsonOk({
    id: updated.id,
    content: updated.content,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    enrollmentId: updated.enrollmentId,
    authorName: owned.student.name,
  });
}

/** Exclui resposta própria do aluno no fórum da aula. */
export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      enrollmentId: string;
      lessonId: string;
      questionId: string;
      replyId: string;
    }>;
  }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId, questionId, replyId } = await context.params;

  const owned = await getOwnStudentReply(user.id, enrollmentId, lessonId, questionId, replyId);
  if (!owned) {
    return jsonErr("NOT_FOUND", "Resposta não encontrada ou você não pode excluí-la.", 404);
  }

  await prisma.enrollmentLessonQuestionReply.delete({
    where: { id: replyId },
  });

  return jsonOk({ deleted: true });
}
