import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { STUDENT_CONTENT_ENROLLMENT_STATUSES } from "@/lib/student-enrollment-access";
import { getLiberatedLessonIdsForEnrollment } from "@/lib/student-lesson-liberation";

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
    where: {
      id: enrollmentId,
      studentId: student.id,
      status: { in: [...STUDENT_CONTENT_ENROLLMENT_STATUSES] },
    },
    select: {
      id: true,
      status: true,
      classGroup: {
        select: { id: true, status: true, endDate: true, courseId: true },
      },
    },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);

  const cg = enrollment.classGroup;
  const courseId = cg.courseId;

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

  const liberadaLessonIds = await getLiberatedLessonIdsForEnrollment({
    enrollmentId: enrollment.id,
    enrollmentStatus: enrollment.status,
    classGroupId: cg.id,
    classGroupStatus: cg.status,
    classGroupEndDate: cg.endDate,
    courseId,
  });

  const progress = await prisma.enrollmentLessonProgress.findUnique({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    select: { completed: true, lastContentPageIndex: true },
  });

  return jsonOk({
    lesson: {
      ...lesson,
      isLiberada: liberadaLessonIds.has(lessonId),
      completed: progress?.completed ?? false,
      lastContentPageIndex: progress?.lastContentPageIndex ?? null,
    },
  });
}
