import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getModulesWithLessonsByCourseId } from "@/lib/course-modules";

function getTodayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Detalhes de uma matrícula (turma) do aluno logado. Apenas role STUDENT. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  const user = await requireRole("STUDENT");
  const { enrollmentId } = await context.params;

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
      classGroup: {
        include: {
          course: true,
          teacher: { select: { id: true, name: true, photoUrl: true } },
          sessions: { orderBy: { sessionDate: "asc" } },
        },
      },
    },
  });

  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const g = enrollment.classGroup;
  const today = getTodayUtcDate();

  await prisma.classSession.updateMany({
    where: {
      classGroupId: g.id,
      status: "SCHEDULED",
      sessionDate: { lte: today },
    },
    data: { status: "LIBERADA" },
  });

  const enrollmentWithUpdatedSessions = await prisma.enrollment.findFirst({
    where: { id: enrollmentId },
    include: {
      classGroup: {
        include: {
          course: true,
          teacher: { select: { id: true, name: true, photoUrl: true } },
          sessions: {
            orderBy: { sessionDate: "asc" },
            include: {
              lesson: {
                select: {
                  id: true,
                  title: true,
                  order: true,
                  durationMinutes: true,
                  videoUrl: true,
                  contentRich: true,
                  imageUrls: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!enrollmentWithUpdatedSessions) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const g2 = enrollmentWithUpdatedSessions.classGroup;
  const course = g2.course;

  const modules = await getModulesWithLessonsByCourseId(course.id);
  const orderedLessonTitles = modules.flatMap((m) => m.lessons.map((l) => l.title));

  return jsonOk({
    enrollment: {
      id: enrollmentWithUpdatedSessions.id,
      classGroupId: g2.id,
      course: {
        name: course.name,
        description: course.description,
        workloadHours: course.workloadHours,
      },
      teacher: g2.teacher.name,
      teacherPhotoUrl: g2.teacher.photoUrl ?? null,
      daysOfWeek: g2.daysOfWeek,
      startDate: g2.startDate,
      endDate: g2.endDate,
      status: g2.status,
      location: g2.location,
      startTime: g2.startTime,
      endTime: g2.endTime,
      certificateUrl: enrollmentWithUpdatedSessions.certificateUrl,
      certificateFileName: enrollmentWithUpdatedSessions.certificateFileName,
      sessions: g2.sessions.map((s, index) => ({
        id: s.id,
        sessionDate: s.sessionDate,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        lessonTitle: s.lesson?.title ?? orderedLessonTitles[index] ?? "—",
        lesson: s.lesson
          ? {
              id: s.lesson.id,
              title: s.lesson.title,
              order: s.lesson.order,
              durationMinutes: s.lesson.durationMinutes,
              videoUrl: s.lesson.videoUrl,
              contentRich: s.lesson.contentRich,
              imageUrls: s.lesson.imageUrls ?? [],
            }
          : null,
      })),
    },
  });
}
