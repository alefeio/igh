import { coordenacaoAuthResponse, requireCoordenacaoViewer } from "@/lib/coordenacao-access";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const TYPES = ["ATTENDANCE", "DROPOUT_RISK", "PERFORMANCE", "SUPPORT", "BEHAVIOR", "ACCESS", "OTHER"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"] as const;

export async function GET(request: Request) {
  try {
    await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }
  const cycleId = new URL(request.url).searchParams.get("cycleId");
  const rows = await prisma.coordinatorIntervention.findMany({
    where: cycleId ? { cycleId } : {},
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      problem: true,
      action: true,
      status: true,
      dueAt: true,
      resultNote: true,
      attendancePercentBefore: true,
      attendancePercentAfter: true,
      enrollmentId: true,
      owner: { select: { name: true } },
    },
  });
  return jsonOk({
    rows,
    open: rows.filter((row) => row.status === "OPEN" || row.status === "IN_PROGRESS").length,
    overdue: rows.filter((row) => row.dueAt && row.dueAt < new Date() && row.status !== "RESOLVED" && row.status !== "CANCELLED").length,
    resolved: rows.filter((row) => row.status === "RESOLVED").length,
  });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }
  const body = (await request.json().catch(() => null)) as {
    enrollmentId?: string;
    classGroupId?: string;
    cycleId?: string;
    type?: string;
    problem?: string;
    action?: string;
    dueAt?: string;
    attendancePercentBefore?: number | null;
  } | null;
  if (!body?.problem?.trim() || !body.action?.trim() || !body.type || !TYPES.includes(body.type as (typeof TYPES)[number])) {
    return jsonErr("VALIDATION_ERROR", "Informe o tipo, o problema e a ação.", 400);
  }
  const created = await prisma.coordinatorIntervention.create({
    data: {
      enrollmentId: body.enrollmentId || null,
      classGroupId: body.classGroupId || null,
      cycleId: body.cycleId || null,
      type: body.type as (typeof TYPES)[number],
      problem: body.problem.trim(),
      action: body.action.trim(),
      ownerUserId: actor.id,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      attendancePercentBefore: body.attendancePercentBefore ?? null,
      status: "OPEN",
    },
    select: { id: true },
  });
  return jsonOk(created);
}

export async function PATCH(request: Request) {
  try {
    await requireCoordenacaoViewer();
  } catch (error) {
    const auth = coordenacaoAuthResponse(error);
    if (auth) return auth;
    throw error;
  }
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: string;
    resultNote?: string;
    attendancePercentAfter?: number | null;
  } | null;
  if (!body?.id || !body.status || !STATUSES.includes(body.status as (typeof STATUSES)[number])) {
    return jsonErr("VALIDATION_ERROR", "Informe a intervenção e o status.", 400);
  }
  const updated = await prisma.coordinatorIntervention.update({
    where: { id: body.id },
    data: {
      status: body.status as (typeof STATUSES)[number],
      resultNote: body.resultNote?.trim() || null,
      attendancePercentAfter: body.attendancePercentAfter ?? undefined,
      resolvedAt: body.status === "RESOLVED" ? new Date() : null,
    },
    select: { id: true, status: true },
  });
  return jsonOk(updated);
}
