import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

const enrollmentLessonQuestion = prisma.enrollmentLessonQuestion;

async function getEnrollmentAndLesson(
  user: { id: string },
  enrollmentId: string,
  lessonId: string
) {
  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) return null;
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
  if (!enrollment) return null;
  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId) return null;
  return { student, enrollment, lesson };
}

/** Atualiza própria dúvida (apenas conteúdo). Apenas STUDENT; só o autor pode editar. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string; questionId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId, questionId } = await context.params;

  const ctx = await getEnrollmentAndLesson(user, enrollmentId, lessonId);
  if (!ctx) return jsonErr("NOT_FOUND", "Matrícula ou aula não encontrada.", 404);

  const question = await enrollmentLessonQuestion.findFirst({
    where: {
      id: questionId,
      lessonId,
      enrollmentId,
      enrollment: { studentId: ctx.student.id },
    },
  });
  if (!question) return jsonErr("NOT_FOUND", "Dúvida não encontrada ou você não pode editá-la.", 404);

  let body: { content?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return jsonErr("BAD_REQUEST", "Digite o conteúdo.", 400);

  const updated = await enrollmentLessonQuestion.update({
    where: { id: questionId },
    data: { content },
    select: { id: true, content: true, createdAt: true },
  });

  const studentName = await prisma.student.findUnique({
    where: { id: ctx.student.id },
    select: { name: true },
  });

  const updatedAt = "updatedAt" in updated ? (updated as { updatedAt: Date }).updatedAt : updated.createdAt;

  return jsonOk({
    id: updated.id,
    content: updated.content,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    enrollmentId,
    authorName: studentName?.name ?? "Aluno",
  });
}

/** Exclui própria dúvida. Apenas STUDENT; só o autor pode excluir. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string; questionId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, questionId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

  const question = await enrollmentLessonQuestion.findFirst({
    where: {
      id: questionId,
      enrollmentId,
      enrollment: { studentId: student.id },
    },
  });
  if (!question) return jsonErr("NOT_FOUND", "Dúvida não encontrada ou você não pode excluí-la.", 404);

  await enrollmentLessonQuestion.delete({
    where: { id: questionId },
  });

  return jsonOk({ deleted: true });
}
