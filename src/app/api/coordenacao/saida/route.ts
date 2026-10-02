import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { DEPARTURE_REASON_LABEL } from "@/lib/coordinator/labels";
import type { DepartureReasonCode } from "@/lib/coordinator/types";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const REASONS = Object.keys(DEPARTURE_REASON_LABEL) as DepartureReasonCode[];

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }
  const body = (await request.json().catch(() => null)) as { enrollmentId?: string; reason?: string; note?: string } | null;
  if (!body?.enrollmentId || !body.reason || !REASONS.includes(body.reason as DepartureReasonCode)) {
    return jsonErr("VALIDATION_ERROR", "Informe a matrícula e um motivo válido.", 400);
  }
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: body.enrollmentId },
    select: { id: true },
  });
  if (!enrollment) return jsonErr("NOT_FOUND", "Matrícula não encontrada.", 404);
  const created = await prisma.enrollmentDeparture.create({
    data: {
      enrollmentId: enrollment.id,
      reason: body.reason as DepartureReasonCode,
      note: body.note?.trim() || null,
      recordedByUserId: actor.id,
    },
    select: { id: true, reason: true, recordedAt: true },
  });
  return jsonOk(created);
}
