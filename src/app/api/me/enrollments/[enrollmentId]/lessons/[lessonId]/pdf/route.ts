import { requireRole } from "@/lib/auth";
import { buildLessonPdf, lessonPdfResponse } from "@/lib/build-lesson-pdf";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/** Gera PDF da aula a partir do conteúdo (título, resumo, conteúdo rico). Apenas STUDENT. */
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
    where: { id: enrollmentId, studentId: student.id, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: { classGroup: { select: { courseId: true } } },
  });
  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true, title: true } } },
  });
  if (!lesson || lesson.module.courseId !== enrollment.classGroup.courseId) {
    return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);
  }

  const course = await prisma.course.findUnique({
    where: { id: enrollment.classGroup.courseId },
    select: { name: true },
  });

  const pdf = await buildLessonPdf({
    title: lesson.title,
    summary: lesson.summary,
    contentRich: lesson.contentRich,
    moduleTitle: lesson.module.title,
    courseName: course?.name ?? "Curso",
  });
  if (!pdf.ok) {
    return jsonErr("BAD_REQUEST", "Esta aula não possui conteúdo para gerar o PDF.", 400);
  }

  // Mantém attachment para compatibilidade com o botão de download do aluno.
  return lessonPdfResponse(pdf, "attachment");
}
