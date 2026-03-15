import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Lista trechos destacados da aula para a matrícula do aluno. Apenas STUDENT. */
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

  const list = await prisma.enrollmentLessonPassage.findMany({
    where: { enrollmentId, lessonId },
    orderBy: { startOffset: "asc" },
    select: {
      id: true,
      text: true,
      startOffset: true,
      createdAt: true,
    },
  });

  return jsonOk(
    list.map((p) => ({
      id: p.id,
      text: p.text,
      startOffset: p.startOffset,
      createdAt: p.createdAt.toISOString(),
    }))
  );
}

/** Cria trecho destacado. Body: { text: string, startOffset: number }. Apenas STUDENT. */
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

  let body: { text?: string; startOffset?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonErr("BAD_REQUEST", "JSON inválido.", 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return jsonErr("BAD_REQUEST", "O texto do trecho é obrigatório.", 400);
  }

  const startOffset =
    typeof body.startOffset === "number" && Number.isFinite(body.startOffset)
      ? Math.max(0, Math.floor(body.startOffset))
      : 0;

  const passage = await prisma.enrollmentLessonPassage.create({
    data: {
      enrollmentId,
      lessonId,
      text,
      startOffset,
    },
    select: {
      id: true,
      text: true,
      startOffset: true,
      createdAt: true,
    },
  });

  return jsonOk({
    id: passage.id,
    text: passage.text,
    startOffset: passage.startOffset,
    createdAt: passage.createdAt.toISOString(),
  });
}
