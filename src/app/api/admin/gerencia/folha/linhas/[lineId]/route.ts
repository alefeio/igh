import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { serializePayrollLine } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import { updatePayrollLineSchema } from "@/lib/validators/payroll";

type Ctx = { params: Promise<{ lineId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { lineId } = await ctx.params;
  const existing = await prisma.payrollLine.findUnique({
    where: { id: lineId },
    include: { payrollMonth: { select: { id: true, status: true } } },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Linha da folha não encontrada.", 404);
  if (existing.payrollMonth.status === "FECHADA") {
    return jsonErr("CLOSED", "Folha fechada — reabra para editar.", 409);
  }

  const body = await request.json().catch(() => null);
  const parsed = updatePayrollLineSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const amount =
    parsed.data.amount !== undefined && parsed.data.amount !== null
      ? parsed.data.amount
      : parsed.data.amountCents;
  const offBooks =
    parsed.data.offBooksPay !== undefined && parsed.data.offBooksPay !== null
      ? parsed.data.offBooksPay
      : parsed.data.offBooksPayCents;

  const paymentStatus = parsed.data.paymentStatus;
  const updated = await prisma.payrollLine.update({
    where: { id: lineId },
    data: {
      ...(amount !== undefined && amount !== null ? { amountCents: amount } : {}),
      ...(offBooks !== undefined && offBooks !== null ? { offBooksPayCents: offBooks } : {}),
      ...(parsed.data.observation !== undefined ? { observation: parsed.data.observation } : {}),
      ...(parsed.data.fundingChannel !== undefined
        ? { fundingChannel: parsed.data.fundingChannel }
        : {}),
      ...(parsed.data.fundingContractRef !== undefined
        ? { fundingContractRef: parsed.data.fundingContractRef }
        : {}),
      ...(paymentStatus !== undefined
        ? {
            paymentStatus,
            paidAt: paymentStatus === "PAGO" ? new Date() : null,
          }
        : {}),
    },
  });

  await createAuditLog({
    entityType: "PayrollLine",
    entityId: lineId,
    action: "UPDATE",
    diff: parsed.data,
    performedByUserId: actor.id,
  });

  return jsonOk({ line: serializePayrollLine(updated) });
}
