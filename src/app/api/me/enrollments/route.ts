import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { applyClassGroupAutomaticStatusUpdatesCached } from "@/lib/class-group-auto-status";
import { STUDENT_VISIBLE_ENROLLMENT_STATUSES } from "@/lib/student-enrollment-access";

export async function GET() {
  const user = await requireRole("STUDENT");

  await applyClassGroupAutomaticStatusUpdatesCached();

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!student) {
    return jsonOk({ enrollments: [] });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id, status: { in: [...STUDENT_VISIBLE_ENROLLMENT_STATUSES] } },
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
      enrollmentStatus: e.status,
      courseName: e.classGroup.course.name,
      teacherName: e.classGroup.teacher.name,
      teacherPhotoUrl: e.classGroup.teacher.photoUrl ?? null,
      startDate: e.classGroup.startDate,
      status: e.classGroup.status,
      location: e.classGroup.location,
    })),
  });
}
