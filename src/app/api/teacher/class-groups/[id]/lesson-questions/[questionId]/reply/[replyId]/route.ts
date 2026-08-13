import { prisma } from "@/lib/prisma";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  isForumPostEmpty,
  mergeForumImagesIntoHtml,
  parseForumImageUrls,
} from "@/lib/forum-question-content";

async function getOwnTeacherReply(
  userId: string,
  classGroupId: string,
  questionId: string,
  replyId: string
) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!teacher) return null;

  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacher.id) },
    select: { courseId: true },
  });
  if (!cg) return null;

  const question = await prisma.enrollmentLessonQuestion.findFirst({
    where: { id: questionId },
    select: { id: true, lessonId: true },
  });
  if (!question) return null;

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: question.lessonId, module: { courseId: cg.courseId } },
    select: { id: true },
  });
  if (!lesson) return null;

  const reply = await prisma.lessonQuestionTeacherReply.findFirst({
    where: {
      id: replyId,
      questionId: question.id,
      teacherId: teacher.id,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      teacherId: true,
    },
  });
  if (!reply) return null;

  return { teacher, reply };
}

/** Atualiza resposta própria do professor no fórum da aula. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; questionId: string; replyId: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId, questionId, replyId } = await context.params;

  const owned = await getOwnTeacherReply(user.id, classGroupId, questionId, replyId);
  if (!owned) {
    return jsonErr("NOT_FOUND", "Resposta não encontrada ou você não pode editá-la.", 404);
  }

  let body: { content?: string; imageUrls?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }
  const rawContent = typeof body.content === "string" ? body.content.trim() : "";
  const imageUrls = parseForumImageUrls(body.imageUrls);
  if (isForumPostEmpty(rawContent, imageUrls)) {
    return jsonErr("BAD_REQUEST", "Digite a resposta ou anexe ao menos uma foto.", 400);
  }
  const content = mergeForumImagesIntoHtml(rawContent, imageUrls);

  const updated = await prisma.lessonQuestionTeacherReply.update({
    where: { id: replyId },
    data: { content },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      teacherId: true,
    },
  });

  return jsonOk({
    id: updated.id,
    content: updated.content,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    teacherId: updated.teacherId,
    teacherName: owned.teacher.name,
  });
}

/** Exclui resposta própria do professor no fórum da aula. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; questionId: string; replyId: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId, questionId, replyId } = await context.params;

  const owned = await getOwnTeacherReply(user.id, classGroupId, questionId, replyId);
  if (!owned) {
    return jsonErr("NOT_FOUND", "Resposta não encontrada ou você não pode excluí-la.", 404);
  }

  await prisma.lessonQuestionTeacherReply.delete({
    where: { id: replyId },
  });

  return jsonOk({ deleted: true });
}
