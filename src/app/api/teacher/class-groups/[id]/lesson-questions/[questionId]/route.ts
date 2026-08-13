import { prisma } from "@/lib/prisma";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { requireRole } from "@/lib/auth";
import {
  isForumPostEmpty,
  parseForumImageUrls,
  stripRichTextToPlain,
} from "@/lib/forum-question-content";
import { jsonErr, jsonOk } from "@/lib/http";

async function assertTeacherOwnsClassGroup(userId: string, classGroupId: string) {
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
  return { teacher, courseId: cg.courseId };
}

async function getOwnTeacherTopic(
  classGroupId: string,
  questionId: string,
  userId: string
) {
  const ctx = await assertTeacherOwnsClassGroup(userId, classGroupId);
  if (!ctx) return null;

  const question = await prisma.enrollmentLessonQuestion.findFirst({
    where: {
      id: questionId,
      teacherAuthorId: ctx.teacher.id,
    },
    select: {
      id: true,
      lessonId: true,
      content: true,
      imageUrls: true,
      createdAt: true,
      updatedAt: true,
      teacherAuthorId: true,
    },
  });
  if (!question) return null;

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: question.lessonId, module: { courseId: ctx.courseId } },
    select: { id: true },
  });
  if (!lesson) return null;

  return { ctx, question };
}

/** Atualiza tópico próprio do professor no fórum da aula. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; questionId: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId, questionId } = await context.params;

  const owned = await getOwnTeacherTopic(classGroupId, questionId, user.id);
  if (!owned) {
    return jsonErr("NOT_FOUND", "Publicação não encontrada ou você não pode editá-la.", 404);
  }

  let body: { content?: string; imageUrls?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }

  const content = typeof body.content === "string" ? body.content : "";
  const imageUrls = parseForumImageUrls(body.imageUrls);
  if (isForumPostEmpty(content, imageUrls)) {
    return jsonErr("BAD_REQUEST", "Escreva uma mensagem ou anexe ao menos uma foto.", 400);
  }

  const updated = await prisma.enrollmentLessonQuestion.update({
    where: { id: questionId },
    data: {
      content: stripRichTextToPlain(content).length > 0 ? content : "",
      imageUrls,
    },
    select: {
      id: true,
      content: true,
      imageUrls: true,
      createdAt: true,
      updatedAt: true,
      teacherAuthorId: true,
    },
  });

  return jsonOk({
    id: updated.id,
    content: updated.content,
    imageUrls: updated.imageUrls ?? [],
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    teacherAuthorId: updated.teacherAuthorId,
    authorName: owned.ctx.teacher.name,
    authorRole: "TEACHER" as const,
  });
}

/** Exclui tópico próprio do professor no fórum da aula. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; questionId: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId, questionId } = await context.params;

  const owned = await getOwnTeacherTopic(classGroupId, questionId, user.id);
  if (!owned) {
    return jsonErr("NOT_FOUND", "Publicação não encontrada ou você não pode excluí-la.", 404);
  }

  await prisma.enrollmentLessonQuestion.delete({
    where: { id: questionId },
  });

  return jsonOk({ deleted: true });
}
