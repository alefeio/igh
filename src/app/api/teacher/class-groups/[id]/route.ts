import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Retorna uma turma que o professor leciona (apenas TEACHER, dono da turma). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["TEACHER"]);
  const { id: classGroupId } = await context.params;
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) return jsonErr("FORBIDDEN", "Perfil de professor não encontrado.", 403);

  const cg = await prisma.classGroup.findUnique({
    where: { id: classGroupId, teacherId: teacher.id },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      capacity: true,
      status: true,
      location: true,
      course: { select: { id: true, name: true } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  return jsonOk({
    classGroup: {
      id: cg.id,
      courseId: cg.course.id,
      courseName: cg.course.name,
      startDate: cg.startDate,
      endDate: cg.endDate,
      daysOfWeek: cg.daysOfWeek,
      startTime: cg.startTime,
      endTime: cg.endTime,
      capacity: cg.capacity,
      status: cg.status,
      location: cg.location,
      enrollmentsCount: cg._count.enrollments,
    },
  });
}
