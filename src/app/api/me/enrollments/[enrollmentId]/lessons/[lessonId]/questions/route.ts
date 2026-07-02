import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { serializeForumQuestion } from "@/lib/forum-question-serialize";
import {
  isForumPostEmpty,
  parseForumImageUrls,
  stripRichTextToPlain,
} from "@/lib/forum-question-content";
import { jsonErr, jsonOk } from "@/lib/http";
import { notifyTeacherOfNewForumQuestion } from "@/lib/forum-user-notifications";
import { captureMilestoneSnapshot, notifyMilestoneDiff } from "@/lib/student-milestone-notifications";

// Modelo de dúvidas por aula (Prisma gera enrollmentLessonQuestion a partir de EnrollmentLessonQuestion)
const enrollmentLessonQuestion = prisma.enrollmentLessonQuestion;

/** Lista dúvidas/comentários da aula (todos os alunos do curso). Apenas STUDENT. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: {
      classGroup: {
        include: {
          sessions: {
            where: { status: "LIBERADA" },
            orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
            select: { lessonId: true },
          },
        },
      },
    },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId)
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);

  const courseId = enrollment.classGroup.courseId;
  const sessions = enrollment.classGroup.sessions;
  const lessonIdsOrder = await getCourseLessonIdsInOrder(courseId);
  const liberadaIds = new Set<string>();
  sessions.forEach((s, i) => {
    if (s.lessonId) liberadaIds.add(s.lessonId);
    else if (lessonIdsOrder[i]) liberadaIds.add(lessonIdsOrder[i]);
  });
  if (!liberadaIds.has(lessonId)) return jsonErr("FORBIDDEN", "Aula não liberada.", 403);

  const questions = await enrollmentLessonQuestion.findMany({
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

  type QuestionRow = {
    id: string;
    content: string;
    imageUrls?: string[];
    createdAt: Date;
    updatedAt: Date;
    enrollmentId: string;
    enrollment: { student: { name: string } };
    replies: Array<{
      id: string;
      content: string;
      createdAt: Date;
      enrollmentId: string;
      enrollment: { student: { name: string } };
    }>;
    teacherReplies?: Array<{
      id: string;
      content: string;
      createdAt: Date;
      teacher: { name: string } | null;
      staffUser: { name: string } | null;
    }>;
  };
  return jsonOk((questions as QuestionRow[]).map((q) => serializeForumQuestion(q)));
}

/** Envia dúvida sobre a aula. Body: { content: string }. Apenas STUDENT. */
export async function POST(
  request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: {
      classGroup: {
        include: {
          sessions: {
            where: { status: "LIBERADA" },
            orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
            select: { lessonId: true },
          },
        },
      },
    },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId)
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);

  const courseId = enrollment.classGroup.courseId;
  const sessions = enrollment.classGroup.sessions;
  const lessonIdsOrder = await getCourseLessonIdsInOrder(courseId);
  const liberadaIds = new Set<string>();
  sessions.forEach((s, i) => {
    if (s.lessonId) liberadaIds.add(s.lessonId);
    else if (lessonIdsOrder[i]) liberadaIds.add(lessonIdsOrder[i]);
  });
  if (!liberadaIds.has(lessonId)) return jsonErr("FORBIDDEN", "Aula não liberada.", 403);

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

  const milestoneBefore = await captureMilestoneSnapshot(student.id);

  const question = await enrollmentLessonQuestion.create({
    data: {
      enrollmentId,
      lessonId,
      content: stripRichTextToPlain(content).length > 0 ? content : "",
      imageUrls,
    },
    select: { id: true, content: true, imageUrls: true, createdAt: true },
  });

  await notifyTeacherOfNewForumQuestion(question.id);
  await notifyMilestoneDiff(student.id, milestoneBefore);

  const studentName = await prisma.student.findUnique({
    where: { id: student.id },
    select: { name: true },
  });

  return jsonOk({
    id: question.id,
    content: question.content,
    imageUrls: question.imageUrls ?? [],
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.createdAt.toISOString(),
    enrollmentId,
    authorName: studentName?.name ?? "Aluno",
    replies: [],
  });
}
