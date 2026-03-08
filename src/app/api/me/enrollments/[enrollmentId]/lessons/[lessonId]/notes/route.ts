import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Lista anotações da aula para a matrícula do aluno. Apenas STUDENT. */
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
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    include: {
      classGroup: { select: { courseId: true } },
    },
  });
  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const notes = await prisma.enrollmentLessonNote.findMany({
    where: { enrollmentId, lessonId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      videoTimestampSecs: true,
      createdAt: true,
    },
  });

  return jsonOk(
    notes.map((n) => ({
      id: n.id,
      content: n.content,
      videoTimestampSecs: n.videoTimestampSecs,
      videoTimestampLabel: formatVideoTimestamp(n.videoTimestampSecs),
      createdAt: n.createdAt.toISOString(),
    }))
  );
}

/** Cria anotação na aula. Body: { content: string, videoTimestampSecs?: number }. Apenas STUDENT. */
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
  if (!student) {
    return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    include: {
      classGroup: { select: { courseId: true } },
    },
  });
  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  let body: { content?: string; videoTimestampSecs?: number } = {};
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
    body.videoTimestampSecs !== undefined && body.videoTimestampSecs !== null
      ? Math.max(0, Math.floor(Number(body.videoTimestampSecs)))
      : null;

  const note = await prisma.enrollmentLessonNote.create({
    data: {
      enrollmentId,
      lessonId,
      content,
      videoTimestampSecs,
    },
    select: {
      id: true,
      content: true,
      videoTimestampSecs: true,
      createdAt: true,
    },
  });

  return jsonOk({
    id: note.id,
    content: note.content,
    videoTimestampSecs: note.videoTimestampSecs,
    videoTimestampLabel: formatVideoTimestamp(note.videoTimestampSecs),
    createdAt: note.createdAt.toISOString(),
  });
}

function formatVideoTimestamp(secs: number | null): string | null {
  if (secs == null || secs < 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
