import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

const MAX_ROWS = 5000;

/**
 * Frequência apenas das turmas em que o professor leciona.
 * Query opcional: classGroupId — deve ser turma do próprio professor.
 */
export async function GET(request: Request) {
  const user = await requireRole(["TEACHER"]);

  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    return jsonOk({ items: [], truncated: false });
  }

  const { searchParams } = new URL(request.url);
  const classGroupIdParam = searchParams.get("classGroupId")?.trim() || undefined;

  if (classGroupIdParam) {
    const owns = await prisma.classGroup.findFirst({
      where: { id: classGroupIdParam, teacherId: teacher.id },
      select: { id: true },
    });
    if (!owns) {
      return jsonErr("FORBIDDEN", "Turma não encontrada ou você não é o professor desta turma.", 403);
    }
  }

  const where = {
    classSession: {
      classGroup: {
        teacherId: teacher.id,
        ...(classGroupIdParam ? { id: classGroupIdParam } : {}),
      },
    },
  };

  const rows = await prisma.sessionAttendance.findMany({
    where,
    take: MAX_ROWS,
    orderBy: [{ classSession: { sessionDate: "desc" } }, { id: "desc" }],
    include: {
      classSession: {
        select: {
          sessionDate: true,
          status: true,
          startTime: true,
          endTime: true,
          lesson: { select: { title: true } },
          classGroup: {
            select: {
              id: true,
              status: true,
              course: { select: { name: true } },
              teacher: { select: { name: true } },
            },
          },
        },
      },
      enrollment: {
        select: {
          status: true,
          student: { select: { name: true } },
        },
      },
    },
  });

  return jsonOk({
    items: rows.map((r) => ({
      id: r.id,
      classGroupId: r.classSession.classGroup.id,
      classGroupStatus: r.classSession.classGroup.status,
      courseName: r.classSession.classGroup.course.name,
      teacherName: r.classSession.classGroup.teacher.name,
      sessionDate: r.classSession.sessionDate.toISOString().slice(0, 10),
      sessionStatus: r.classSession.status,
      sessionStartTime: r.classSession.startTime,
      sessionEndTime: r.classSession.endTime,
      lessonTitle: r.classSession.lesson?.title ?? null,
      studentName: r.enrollment.student.name,
      enrollmentStatus: r.enrollment.status,
      present: r.present,
      absenceJustification: r.absenceJustification,
      updatedAt: r.updatedAt.toISOString(),
    })),
    truncated: rows.length >= MAX_ROWS,
  });
}
