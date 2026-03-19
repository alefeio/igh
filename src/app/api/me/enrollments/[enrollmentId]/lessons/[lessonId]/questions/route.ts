import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

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
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
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
        include: { teacher: { select: { name: true } } },
      },
    },
  });

  type QuestionRow = {
    id: string;
    content: string;
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
      teacher: { name: string };
    }>;
  };
  return jsonOk(
    (questions as QuestionRow[]).map((q) => ({
      id: q.id,
      content: q.content,
      createdAt: q.createdAt.toISOString(),
      updatedAt: (q as { updatedAt?: Date }).updatedAt?.toISOString() ?? q.createdAt.toISOString(),
      enrollmentId: q.enrollmentId,
      authorName: q.enrollment.student.name,
      replies: (q.replies ?? []).map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        enrollmentId: r.enrollmentId,
        authorName: r.enrollment.student.name,
      })),
      teacherReplies: (q.teacherReplies ?? []).map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        teacherName: r.teacher.name,
      })),
    }))
  );
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
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
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

  let body: { content?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return jsonErr("BAD_REQUEST", "Digite sua dúvida.", 400);

  const question = await enrollmentLessonQuestion.create({
    data: { enrollmentId, lessonId, content },
    select: { id: true, content: true, createdAt: true },
  });

  const studentName = await prisma.student.findUnique({
    where: { id: student.id },
    select: { name: true },
  });

  return jsonOk({
    id: question.id,
    content: question.content,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.createdAt.toISOString(),
    enrollmentId,
    authorName: studentName?.name ?? "Aluno",
    replies: [],
  });
}
