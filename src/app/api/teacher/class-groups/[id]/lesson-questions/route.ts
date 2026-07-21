import { prisma } from "@/lib/prisma";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { requireRole } from "@/lib/auth";
import { mapStaffOrTeacherReplyName } from "@/lib/course-forum-reply-display";
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
    select: { courseId: true, course: { select: { name: true } } },
  });
  if (!cg) return null;
  return { teacher, courseId: cg.courseId, courseName: cg.course.name };
}

/** Lista dúvidas do curso da turma (para o professor responder). */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;
  const ctx = await assertTeacherOwnsClassGroup(user.id, classGroupId);
  if (!ctx) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const { searchParams } = new URL(request.url);
  const lessonIdFilter = searchParams.get("lessonId")?.trim() || null;

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

  const ids = lessonIdFilter
    ? lessonIds.filter((l) => l.id === lessonIdFilter).map((l) => l.id)
    : lessonIds.map((l) => l.id);
  if (ids.length === 0) return jsonOk({ questions: [], courseName: ctx.courseName });

  const questions = await prisma.enrollmentLessonQuestion.findMany({
    where: { lessonId: { in: ids } },
    orderBy: { updatedAt: "desc" },
    take: 300,
    include: {
      enrollment: { select: { student: { select: { name: true } } } },
      teacherAuthor: { select: { name: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: {
          enrollment: { select: { student: { select: { name: true } } } },
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
        imageUrls: q.imageUrls ?? [],
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
        authorName: q.teacherAuthor?.name ?? q.enrollment?.student.name ?? "Professor",
        authorRole: q.teacherAuthor ? "TEACHER" : "STUDENT",
        replies: q.replies.map((r) => ({
          id: r.id,
          content: r.content,
          createdAt: r.createdAt.toISOString(),
          authorName: r.enrollment.student.name,
        })),
        teacherReplies: q.teacherReplies.map((r) => ({
          id: r.id,
          content: r.content,
          createdAt: r.createdAt.toISOString(),
          teacherName: mapStaffOrTeacherReplyName(r),
        })),
      };
    }),
  });
}

/** Publica um novo tópico do professor no fórum da aula. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;
  const ctx = await assertTeacherOwnsClassGroup(user.id, classGroupId);
  if (!ctx) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  let body: { lessonId?: string; content?: string; imageUrls?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }

  const lessonId = typeof body.lessonId === "string" ? body.lessonId.trim() : "";
  const rawContent = typeof body.content === "string" ? body.content : "";
  const imageUrls = parseForumImageUrls(body.imageUrls);
  if (!lessonId) return jsonErr("BAD_REQUEST", "Aula não informada.", 400);
  if (isForumPostEmpty(rawContent, imageUrls)) {
    return jsonErr("BAD_REQUEST", "Escreva uma mensagem ou anexe ao menos uma foto.", 400);
  }

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, module: { courseId: ctx.courseId } },
    select: { id: true },
  });
  if (!lesson) return jsonErr("NOT_FOUND", "Aula não encontrada neste curso.", 404);

  const topic = await prisma.enrollmentLessonQuestion.create({
    data: {
      enrollmentId: null,
      teacherAuthorId: ctx.teacher.id,
      lessonId,
      content: stripRichTextToPlain(rawContent).length > 0 ? rawContent : "",
      imageUrls,
    },
    select: {
      id: true,
      content: true,
      imageUrls: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return jsonOk({
    id: topic.id,
    lessonId,
    content: topic.content,
    imageUrls: topic.imageUrls,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
    authorName: ctx.teacher.name,
    authorRole: "TEACHER",
    replies: [],
    teacherReplies: [],
  });
}
