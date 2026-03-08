import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Cria resposta a um comentário/dúvida. Body: { content: string }. Apenas STUDENT. */
export async function POST(
  request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string; questionId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId, questionId } = await context.params;

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

  const question = await prisma.enrollmentLessonQuestion.findFirst({
    where: { id: questionId, lessonId },
  });
  if (!question) return jsonErr("NOT_FOUND", "Comentário não encontrado.", 404);

  let body: { content?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return jsonErr("BAD_REQUEST", "Digite sua resposta.", 400);

  const reply = await prisma.enrollmentLessonQuestionReply.create({
    data: { questionId, enrollmentId, content },
    include: {
      enrollment: { select: { student: { select: { name: true } } } },
    },
  });

  const authorName = reply.enrollment.student.name;

  return jsonOk({
    id: reply.id,
    content: reply.content,
    createdAt: reply.createdAt.toISOString(),
    enrollmentId: reply.enrollmentId,
    authorName,
  });
}
