import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { applyClassGroupAutomaticStatusUpdates } from "@/lib/class-group-auto-status";

/** Lista turmas que o professor leciona (apenas TEACHER). */
export async function GET() {
  const user = await requireRole(["TEACHER"]);
  await applyClassGroupAutomaticStatusUpdates();
  const teacher = await prisma.teacher.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    return jsonOk({ classGroups: [] });
  }
  const classGroups = await prisma.classGroup.findMany({
    where: { teacherId: teacher.id },
    orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
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
  return jsonOk({
    classGroups: classGroups.map((cg) => ({
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
    })),
  });
}
