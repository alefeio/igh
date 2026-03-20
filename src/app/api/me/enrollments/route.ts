import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { applyClassGroupAutomaticStatusUpdates } from "@/lib/class-group-auto-status";

export async function GET() {
  const user = await requireRole("STUDENT");

  await applyClassGroupAutomaticStatusUpdates();

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonOk({ enrollments: [] });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    orderBy: { enrolledAt: "desc" },
    include: {
      classGroup: {
        include: {
          course: { select: { id: true, name: true } },
          teacher: { select: { id: true, name: true, photoUrl: true } },
        },
      },
    },
  });

  return jsonOk({
    enrollments: enrollments.map((e) => ({
      id: e.id,
      classGroupId: e.classGroupId,
      courseName: e.classGroup.course.name,
      teacherName: e.classGroup.teacher.name,
      teacherPhotoUrl: e.classGroup.teacher.photoUrl ?? null,
      startDate: e.classGroup.startDate,
      status: e.classGroup.status,
      location: e.classGroup.location,
    })),
  });
}
