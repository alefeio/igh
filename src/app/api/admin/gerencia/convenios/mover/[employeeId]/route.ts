import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { moveEmployeeAgreementSchema } from "@/lib/validators/goals-agreements";
import { employeePositionText, type EmployeePosition } from "@/lib/employees";

type Ctx = { params: Promise<{ employeeId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { employeeId } = await ctx.params;
  const existing = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: {
      id: true,
      name: true,
      cpf: true,
      position: true,
      positionLabel: true,
      status: true,
      monthlyPayCents: true,
      paymentAgreementId: true,
    },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Colaborador não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = moveEmployeeAgreementSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  if (parsed.data.paymentAgreementId) {
    const column = await prisma.paymentAgreement.findFirst({
      where: { id: parsed.data.paymentAgreementId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!column) return jsonErr("NOT_FOUND", "Convênio não encontrado.", 404);
  }

  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data: {
      paymentAgreementId: parsed.data.paymentAgreementId,
      ...(parsed.data.monthlyPay !== undefined
        ? { monthlyPayCents: parsed.data.monthlyPay }
        : {}),
    },
    select: {
      id: true,
      name: true,
      cpf: true,
      position: true,
      positionLabel: true,
      status: true,
      monthlyPayCents: true,
      paymentAgreementId: true,
    },
  });

  await createAuditLog({
    entityType: "Employee",
    entityId: employeeId,
    action: "AGREEMENT_MOVE",
    diff: {
      paymentAgreementId: parsed.data.paymentAgreementId,
      monthlyPayCents: updated.monthlyPayCents,
    },
    performedByUserId: actor.id,
  });

  return jsonOk({
    employee: {
      id: updated.id,
      name: updated.name,
      cpf: updated.cpf,
      positionLabel: employeePositionText({
        position: updated.position as EmployeePosition,
        positionLabel: updated.positionLabel,
      }),
      status: updated.status,
      monthlyPayCents: updated.monthlyPayCents,
      paymentAgreementId: updated.paymentAgreementId,
    },
  });
}
