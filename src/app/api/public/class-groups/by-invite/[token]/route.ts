import { CLASS_GROUP_OPERATIONAL_ENROLLABLE } from "@/lib/class-group-scope";
import { ENROLLMENT_STATUSES_OCCUPYING_SEAT } from "@/lib/enrollment-seat";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";

/** Dados públicos da turma pelo token de convite. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await context.params;
  const token = decodeURIComponent(rawToken ?? "").trim();
  if (!token) {
    return jsonErr("NOT_FOUND", "Link de inscrição inválido.", 404);
  }

  const cg = await prisma.classGroup.findFirst({
    where: { enrollmentInviteToken: token },
    select: {
      id: true,
      status: true,
      capacity: true,
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      startDate: true,
      endDate: true,
      location: true,
      course: { select: { id: true, name: true } },
      cycle: { select: { cycle: true, year: true } },
      _count: {
        select: {
          enrollments: { where: { status: { in: [...ENROLLMENT_STATUSES_OCCUPYING_SEAT] } } },
        },
      },
    },
  });

  if (!cg) {
    return jsonErr("NOT_FOUND", "Link de inscrição inválido ou expirado.", 404);
  }

  const occupied = cg._count.enrollments;
  const seatsRemaining = Math.max(0, cg.capacity - occupied);
  const statusOk = (CLASS_GROUP_OPERATIONAL_ENROLLABLE as readonly string[]).includes(cg.status);
  const acceptingEnrollments = statusOk && seatsRemaining > 0;

  let closedReason: string | null = null;
  if (cg.status === "CANCELADA") closedReason = "Esta turma foi cancelada.";
  else if (cg.status === "ENCERRADA") closedReason = "Esta turma já foi encerrada.";
  else if (!statusOk) closedReason = "Esta turma não está aceitando matrículas no momento.";
  else if (seatsRemaining <= 0) closedReason = "Esta turma não possui vagas disponíveis.";

  return jsonOk({
    classGroup: {
      courseName: cg.course.name,
      cycleNumber: cg.cycle.cycle,
      cycleYear: cg.cycle.year,
      daysOfWeek: cg.daysOfWeek,
      startTime: cg.startTime,
      endTime: cg.endTime,
      startDate: cg.startDate.toISOString().slice(0, 10),
      endDate: cg.endDate ? cg.endDate.toISOString().slice(0, 10) : null,
      location: cg.location,
      capacity: cg.capacity,
      seatsRemaining,
      acceptingEnrollments,
      closedReason,
    },
  });
}
