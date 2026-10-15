import { ENROLLMENT_STATUSES_OCCUPYING_SEAT } from "@/lib/enrollment-seat";
import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";
import { requireReadableClassGroup } from "@/lib/teacher-class-group-access";

/** Lista de espera da turma, na ordem de cadastro. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: classGroupId } = await context.params;
  const access = await requireReadableClassGroup(classGroupId);
  if ("error" in access) return access.error;

  const [classGroup, occupiedSeats, entries] = await Promise.all([
    prisma.classGroup.findUnique({
      where: { id: classGroupId },
      select: { capacity: true, status: true },
    }),
    prisma.enrollment.count({
      where: {
        classGroupId,
        status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] },
      },
    }),
    prisma.enrollmentWaitlist.findMany({
      where: { classGroupId, status: "WAITING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        student: { select: { name: true, email: true, phone: true } },
      },
    }),
  ]);

  const capacity = classGroup?.capacity ?? 0;
  const closed = classGroup ? ["ENCERRADA", "CANCELADA"].includes(classGroup.status) : true;
  const seatsRemaining = Math.max(0, capacity - occupiedSeats);

  return jsonOk({
    waitlist: {
      capacity,
      occupiedSeats,
      seatsRemaining,
      canEnroll: !access.readOnly && !closed && seatsRemaining > 0,
      entries: entries.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        studentName: entry.student.name,
        studentEmail: entry.student.email,
        studentPhone: entry.student.phone,
      })),
    },
  });
}
