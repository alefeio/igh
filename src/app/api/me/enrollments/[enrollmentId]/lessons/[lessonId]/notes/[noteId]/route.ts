import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

function formatVideoTimestamp(secs: number | null): string | null {
  if (secs == null || secs < 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

async function findOwnedNote(
  userId: string,
  enrollmentId: string,
  lessonId: string,
  noteId: string
) {
  const student = await prisma.student.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!student) return null;

  return prisma.enrollmentLessonNote.findFirst({
    where: {
      id: noteId,
      enrollmentId,
      lessonId,
      enrollment: { studentId: student.id, status: { in: ["ACTIVE", "COMPLETED"] } },
    },
  });
}

/** Atualiza uma anotação. Apenas STUDENT; a anotação deve pertencer ao aluno. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string; noteId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId, noteId } = await context.params;

  const note = await findOwnedNote(user.id, enrollmentId, lessonId, noteId);
  if (!note) {
    return jsonErr("NOT_FOUND", "Anotação não encontrada.", 404);
  }

  let body: { content?: string; videoTimestampSecs?: number | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return jsonErr("BAD_REQUEST", "O conteúdo da anotação é obrigatório.", 400);
  }

  const videoTimestampSecs =
    body.videoTimestampSecs === undefined
      ? note.videoTimestampSecs
      : body.videoTimestampSecs === null
        ? null
        : Math.max(0, Math.floor(Number(body.videoTimestampSecs)));

  const updated = await prisma.enrollmentLessonNote.update({
    where: { id: noteId },
    data: { content, videoTimestampSecs },
    select: {
      id: true,
      content: true,
      videoTimestampSecs: true,
      createdAt: true,
    },
  });

  return jsonOk({
    id: updated.id,
    content: updated.content,
    videoTimestampSecs: updated.videoTimestampSecs,
    videoTimestampLabel: formatVideoTimestamp(updated.videoTimestampSecs),
    createdAt: updated.createdAt.toISOString(),
  });
}

/** Exclui uma anotação. Apenas STUDENT; a anotação deve pertencer ao aluno. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string; lessonId: string; noteId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId, lessonId, noteId } = await context.params;

  const note = await findOwnedNote(user.id, enrollmentId, lessonId, noteId);
  if (!note) {
    return jsonErr("NOT_FOUND", "Anotação não encontrada.", 404);
  }

  await prisma.enrollmentLessonNote.delete({
    where: { id: noteId },
  });

  return jsonOk({ deleted: true });
}
