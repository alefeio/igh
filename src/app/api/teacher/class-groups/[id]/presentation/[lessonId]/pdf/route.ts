import { requireRole } from "@/lib/auth";
import { buildLessonPdf, lessonPdfResponse } from "@/lib/build-lesson-pdf";
import { classGroupTeacherAccessWhere } from "@/lib/class-group-teachers";
import { jsonErr } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** PDF gerado automaticamente do conteúdo da aula (modo apresentação do professor). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; lessonId: string }> }
) {
  const user = await requireRole(["TEACHER", "ADMIN", "MASTER", "GENERAL_ADMIN"]);
  const { id: classGroupId, lessonId } = await context.params;

  const isTeacher = user.role === "TEACHER";

  let courseId: string;
  let courseName: string;

  if (isTeacher) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

    const cg = await prisma.classGroup.findFirst({
      where: { id: classGroupId, ...classGroupTeacherAccessWhere(teacher.id) },
      select: {
        courseId: true,
        course: { select: { name: true } },
      },
    });
    if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);
    courseId = cg.courseId;
    courseName = cg.course.name;
  } else {
    const cg = await prisma.classGroup.findFirst({
      where: { id: classGroupId },
      select: {
        courseId: true,
        course: { select: { name: true } },
      },
    });
    if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);
    courseId = cg.courseId;
    courseName = cg.course.name;
  }

  const lesson = await prisma.courseLesson.findFirst({
    where: {
      id: lessonId,
      module: { courseId },
    },
    include: { module: { select: { title: true } } },
  });
  if (!lesson) return jsonErr("NOT_FOUND", "Aula não encontrada neste curso.", 404);

  const pdf = await buildLessonPdf({
    title: lesson.title,
    summary: lesson.summary,
    contentRich: lesson.contentRich,
    moduleTitle: lesson.module.title,
    courseName,
  });
  if (!pdf.ok) {
    return jsonErr("BAD_REQUEST", "Esta aula não possui conteúdo para gerar o PDF.", 400);
  }

  return lessonPdfResponse(pdf, "inline");
}
