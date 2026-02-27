import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

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
          teacher: { select: { id: true, name: true } },
          sessions: { orderBy: { sessionDate: "asc" } },
        },
      },
    },
  });

  if (!enrollment) {
    return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  }

  const g = enrollment.classGroup;
  const course = g.course;

  return jsonOk({
    enrollment: {
      id: enrollment.id,
      classGroupId: g.id,
      course: {
        name: course.name,
        description: course.description,
        workloadHours: course.workloadHours,
      },
      teacher: g.teacher.name,
      daysOfWeek: g.daysOfWeek,
      startDate: g.startDate,
      endDate: g.endDate,
      status: g.status,
      location: g.location,
      startTime: g.startTime,
      endTime: g.endTime,
      certificateUrl: enrollment.certificateUrl,
      certificateFileName: enrollment.certificateFileName,
      sessions: g.sessions.map((s) => ({
        id: s.id,
        sessionDate: s.sessionDate,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
      })),
    },
  });
}
