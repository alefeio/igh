import { prisma } from "@/lib/prisma";
import { requireReadableClassGroup } from "@/lib/teacher-class-group-access";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";

export const dynamic = "force-dynamic";

/** Conteúdo completo de uma aula para o professor apresentar em sala (sem progresso do aluno). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; lessonId: string }> }
) {
  const { id: classGroupId, lessonId } = await context.params;
  const access = await requireReadableClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId },
    select: {
      id: true,
      courseId: true,
      course: { select: { name: true } },
    },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  const lesson = await prisma.courseLesson.findFirst({
    where: {
      id: lessonId,
      module: { courseId: cg.courseId },
    },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: {
          options: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!lesson) return jsonErr("NOT_FOUND", "Aula não encontrada neste curso.", 404);

  const modules = await getModulesWithLessonsByCourseId(cg.courseId);

  const orderedLessons = modules.flatMap((m) =>
    m.lessons.map((l) => ({ id: l.id, title: l.title, moduleTitle: m.title }))
  );
  const idx = orderedLessons.findIndex((l) => l.id === lessonId);
  const prevLessonId = idx > 0 ? orderedLessons[idx - 1]!.id : null;
  const nextLessonId = idx >= 0 && idx < orderedLessons.length - 1 ? orderedLessons[idx + 1]!.id : null;

  return jsonOk({
    classGroup: { id: cg.id, courseName: cg.course.name },
    navigation: { prevLessonId, nextLessonId },
    lesson: {
      id: lesson.id,
      title: lesson.title,
      order: lesson.order,
      durationMinutes: lesson.durationMinutes,
      videoUrl: lesson.videoUrl,
      contentRich: lesson.contentRich,
      summary: lesson.summary,
      imageUrls: lesson.imageUrls ?? [],
      pdfUrl: lesson.pdfUrl,
      attachmentUrls: lesson.attachmentUrls ?? [],
      attachmentNames: lesson.attachmentNames ?? [],
    },
    exercises: lesson.exercises.map((ex) => ({
      id: ex.id,
      order: ex.order,
      question: ex.question,
      answerJustification: ex.answerJustification,
      options: ex.options.map((o) => ({
        id: o.id,
        order: o.order,
        text: o.text,
        isCorrect: o.isCorrect,
      })),
    })),
  });
}
