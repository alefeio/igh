import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updatePaymentAgreementSchema } from "@/lib/validators/goals-agreements";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.paymentAgreement.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Convênio não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updatePaymentAgreementSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  try {
    const column = await prisma.paymentAgreement.update({
      where: { id },
      data: parsed.data,
    });
    await createAuditLog({
      entityType: "PaymentAgreement",
      entityId: id,
      action: "UPDATE",
      diff: { fields: Object.keys(parsed.data) },
      performedByUserId: actor.id,
    });
    return jsonOk({ column });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return jsonErr("DUPLICATE", "Já existe um convênio com este nome.", 409);
    }
    throw e;
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.paymentAgreement.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Convênio não encontrado.", 404);

  await prisma.$transaction([
    prisma.employee.updateMany({
      where: { paymentAgreementId: id },
      data: { paymentAgreementId: null },
    }),
    prisma.paymentAgreement.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    }),
  ]);

  await createAuditLog({
    entityType: "PaymentAgreement",
    entityId: id,
    action: "ARCHIVE",
    diff: { name: existing.name },
    performedByUserId: actor.id,
  });

  return jsonOk({ archived: true });
}
