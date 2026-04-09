import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import { getEndOfTodayBrazil } from "@/lib/brazil-today";

export const dynamic = "force-dynamic";

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
  if (!student) return jsonErr("NOT_FOUND", "Aluno não encontrado.", 404);

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, studentId: student.id, status: "ACTIVE" },
    select: {
      id: true,
      classGroup: { select: { id: true, courseId: true } },
    },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  const endOfTodayBrazil = getEndOfTodayBrazil();
  await prisma.classSession.updateMany({
    where: {
      classGroupId: enrollment.classGroup.id,
      status: "SCHEDULED",
      sessionDate: { lte: endOfTodayBrazil },
    },
    data: { status: "LIBERADA" },
  });

  const courseId = enrollment.classGroup.courseId;

  // Confere se a aula pertence ao curso da matrícula.
  const lesson = await prisma.courseLesson.findFirst({
    where: { id: lessonId, module: { courseId } },
    select: {
      id: true,
      title: true,
      order: true,
      durationMinutes: true,
      videoUrl: true,
      contentRich: true,
      summary: true,
      imageUrls: true,
      pdfUrl: true,
      attachmentUrls: true,
      attachmentNames: true,
    },
  });
  if (!lesson) return jsonErr("NOT_FOUND", "Aula não encontrada.", 404);

  const liberadaSessionsOrdered = await prisma.classSession.findMany({
    where: { classGroupId: enrollment.classGroup.id, status: "LIBERADA" },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    select: { lessonId: true },
  });
  const courseLessonIdsInOrder = await getCourseLessonIdsInOrder(courseId);
  const liberadaLessonIds = new Set<string>();
  liberadaSessionsOrdered.forEach((session, index) => {
    if (session.lessonId) liberadaLessonIds.add(session.lessonId);
    else if (courseLessonIdsInOrder[index]) liberadaLessonIds.add(courseLessonIdsInOrder[index]);
  });

  const progress = await prisma.enrollmentLessonProgress.findUnique({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    select: { completed: true, lastContentPageIndex: true },
  });

  return jsonOk({
    lesson: {
      ...lesson,
      videoUrl: lesson.videoUrl ?? null,
      contentRich: lesson.contentRich ?? null,
      summary: lesson.summary ?? null,
      imageUrls: lesson.imageUrls ?? [],
      pdfUrl: lesson.pdfUrl ?? null,
      attachmentUrls: lesson.attachmentUrls ?? [],
      attachmentNames: lesson.attachmentNames ?? [],
      isLiberada: liberadaLessonIds.has(lesson.id),
      completed: progress?.completed ?? false,
      lastContentPageIndex: progress?.lastContentPageIndex ?? null,
    },
  });
}

