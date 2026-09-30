import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { requireReadableClassGroup } from "@/lib/teacher-class-group-access";

/** Retorna a turma: o professor só vê as próprias; o Administrador Pedagógico vê qualquer uma. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: classGroupId } = await context.params;
  const access = await requireReadableClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const cg = await prisma.classGroup.findFirst({
    where: { id: classGroupId },
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
      cycle: { select: { cycle: true, year: true } },
      _count: {
        select: {
          enrollments: { where: { status: { in: ["ACTIVE", "SUSPENDED"] } } },
        },
      },
    },
  });
  if (!cg) return jsonErr("NOT_FOUND", "Turma não encontrada.", 404);

  return jsonOk({
    classGroup: {
      id: cg.id,
      courseId: cg.course.id,
      courseName: cg.course.name,
      cycleNumber: cg.cycle.cycle,
      cycleYear: cg.cycle.year,
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
