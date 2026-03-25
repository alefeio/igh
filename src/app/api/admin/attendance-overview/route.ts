import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

const MAX_ROWS = 5000;

/**
 * Lista registros de frequência (presença/ausência por sessão) de todas as turmas.
 * Query opcional: classGroupId — restringe a uma turma.
 */
export async function GET(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);

  const { searchParams } = new URL(request.url);
  const classGroupId = searchParams.get("classGroupId")?.trim() || undefined;

  const where = {
    ...(classGroupId
      ? { classSession: { classGroupId } }
      : {}),
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
