import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateMealTicketLineSchema } from "@/lib/validators/payroll";

type Ctx = { params: Promise<{ id: string }> };

function serializeMeal(month: {
  id: string;
  payrollMonthId: string;
  lines: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    positionLabel: string;
    status: string;
    notes: string | null;
    confirmedAt: Date | null;
  }>;
  payrollMonth: { referenceMonth: Date };
}) {
  const confirmed = month.lines.filter((l) => l.status === "CONFIRMED").length;
  return {
    id: month.id,
    payrollMonthId: month.payrollMonthId,
    referenceMonth: `${month.payrollMonth.referenceMonth.getUTCFullYear()}-${String(month.payrollMonth.referenceMonth.getUTCMonth() + 1).padStart(2, "0")}`,
    totals: {
      total: month.lines.length,
      confirmed,
      pending: month.lines.length - confirmed,
    },
    lines: month.lines.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      employeeName: l.employeeName,
      positionLabel: l.positionLabel,
      status: l.status,
      notes: l.notes,
      confirmedAt: l.confirmedAt?.toISOString() ?? null,
    })),
  };
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const month = await prisma.mealTicketMonth.findUnique({
    where: { payrollMonthId: id },
    include: {
      lines: { orderBy: { employeeName: "asc" } },
      payrollMonth: { select: { referenceMonth: true } },
    },
  });
  if (!month) return jsonErr("NOT_FOUND", "Tickets deste mês não encontrados.", 404);
  return jsonOk({ mealTicket: serializeMeal(month) });
}

export async function PATCH(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id: payrollMonthId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const lineId = typeof body?.lineId === "string" ? body.lineId : null;
  if (!lineId) return jsonErr("VALIDATION_ERROR", "Informe lineId.", 400);

  const parsed = updateMealTicketLineSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const meal = await prisma.mealTicketMonth.findUnique({
    where: { payrollMonthId },
    select: { id: true },
  });
  if (!meal) return jsonErr("NOT_FOUND", "Tickets deste mês não encontrados.", 404);

  const line = await prisma.mealTicketLine.findFirst({
    where: { id: lineId, mealTicketMonthId: meal.id },
  });
  if (!line) return jsonErr("NOT_FOUND", "Linha de ticket não encontrada.", 404);

  await prisma.mealTicketLine.update({
    where: { id: lineId },
    data: {
      ...(parsed.data.status !== undefined
        ? {
            status: parsed.data.status,
            confirmedAt: parsed.data.status === "CONFIRMED" ? new Date() : null,
          }
        : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    },
  });

  await createAuditLog({
    entityType: "MealTicketLine",
    entityId: lineId,
    action: "UPDATE",
    diff: parsed.data,
    performedByUserId: actor.id,
  });

  const refreshed = await prisma.mealTicketMonth.findUniqueOrThrow({
    where: { payrollMonthId },
    include: {
      lines: { orderBy: { employeeName: "asc" } },
      payrollMonth: { select: { referenceMonth: true } },
    },
  });

  return jsonOk({ mealTicket: serializeMeal(refreshed) });
}
