import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Exclui um trecho destacado. Apenas STUDENT; o trecho deve pertencer à matrícula do aluno. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string; passageId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId, passageId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const passage = await prisma.enrollmentLessonPassage.findFirst({
    where: {
      id: passageId,
      enrollmentId,
      lessonId,
      enrollment: { studentId: student.id, status: "ACTIVE" },
    },
  });
  if (!passage) {
    return jsonErr("NOT_FOUND", "Trecho não encontrado.", 404);
  }

  await prisma.enrollmentLessonPassage.delete({
    where: { id: passageId },
  });

  return jsonOk({ deleted: true });
}
