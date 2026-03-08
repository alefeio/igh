import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

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

  const question = await prisma.enrollmentLessonQuestion.findFirst({
    where: {
      id: questionId,
      enrollmentId,
      enrollment: { studentId: student.id, status: "ACTIVE" },
    },
  });
  if (!question) return jsonErr("NOT_FOUND", "Dúvida não encontrada ou você não pode excluí-la.", 404);

  await prisma.enrollmentLessonQuestion.delete({
    where: { id: questionId },
  });

  return jsonOk({ deleted: true });
}
