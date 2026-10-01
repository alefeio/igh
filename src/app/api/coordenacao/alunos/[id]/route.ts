import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { DEPARTURE_REASON_LABEL } from "@/lib/coordinator/labels";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }
  const { id } = await context.params;
  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      isPreEnrollment: true,
      enrollmentConfirmedAt: true,
      enrolledAt: true,
      certificateEligible: true,
      student: { select: { id: true, name: true, email: true, phone: true } },
      classGroup: {
        select: {
          id: true,
          startTime: true,
          status: true,
          course: { select: { name: true } },
          teacher: { select: { name: true } },
          cycle: { select: { cycle: true, year: true } },
        },
      },
      historyEntries: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, kind: true, body: true, createdAt: true, author: { select: { name: true } } },
      },
      departures: {
        orderBy: { recordedAt: "desc" },
        take: 10,
        select: { id: true, reason: true, note: true, recordedAt: true, recordedBy: { select: { name: true } } },
      },
    },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  const interventions = await prisma.coordinatorIntervention.findMany({
    where: { enrollmentId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, problem: true, action: true, status: true, resultNote: true, createdAt: true, owner: { select: { name: true } } },
  });
  return jsonOk({
    enrollment,
    interventions,
    reasonLabels: DEPARTURE_REASON_LABEL,
  });
}
