import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Exclui uma anotação. Apenas STUDENT; a anotação deve pertencer ao aluno. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string; noteId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId, noteId } = await context.params;

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const note = await prisma.enrollmentLessonNote.findFirst({
    where: {
      id: noteId,
      enrollmentId,
      lessonId,
      enrollment: { studentId: student.id, status: "ACTIVE" },
    },
  });
  if (!note) {
    return jsonErr("NOT_FOUND", "Anotação não encontrada.", 404);
  }

  await prisma.enrollmentLessonNote.delete({
    where: { id: noteId },
  });

  return jsonOk({ deleted: true });
}
