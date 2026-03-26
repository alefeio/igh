import { prisma } from "@/lib/prisma";
import { requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Resposta no fórum como admin/master (visível para todo o curso, como resposta de professor). */
export async function POST(
  request: Request,
  context: { params: Promise<{ courseId: string; questionId: string }> }
) {
  const user = await requireStaffWrite();
  const { courseId, questionId } = await context.params;

  const question = await prisma.enrollmentLessonQuestion.findFirst({
    where: { id: questionId },
    select: { id: true, lessonId: true },
  });
  if (!question) return jsonErr("NOT_FOUND", "Tópico não encontrado.", 404);

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: question.lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== courseId) {
    return jsonErr("NOT_FOUND", "Tópico não pertence a este curso.", 404);
  }

  let body: { content?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (content.length < 2) return jsonErr("BAD_REQUEST", "Digite a resposta.", 400);

  const reply = await prisma.lessonQuestionTeacherReply.create({
    data: {
      questionId: question.id,
      teacherId: null,
      staffUserId: user.id,
      content,
    },
    select: { id: true, content: true, createdAt: true },
  });

  return jsonOk({
    id: reply.id,
    content: reply.content,
    createdAt: reply.createdAt.toISOString(),
    teacherName: user.name,
  });
}
