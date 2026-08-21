import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { serializePayrollMonth } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import { updatePayrollMonthSchema } from "@/lib/validators/payroll";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const row = await prisma.payrollMonth.findUnique({
    where: { id },
    include: { lines: { orderBy: [{ sortOrder: "asc" }, { employeeName: "asc" }] } },
  });
  if (!row) return jsonErr("NOT_FOUND", "Folha não encontrada.", 404);
  return jsonOk({ payroll: serializePayrollMonth(row) });
}

export async function PATCH(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.payrollMonth.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return jsonErr("NOT_FOUND", "Folha não encontrada.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updatePayrollMonthSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const row = await prisma.payrollMonth.update({
    where: { id },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.responsibleName !== undefined
        ? { responsibleName: parsed.data.responsibleName }
        : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    },
    include: { lines: { orderBy: [{ sortOrder: "asc" }, { employeeName: "asc" }] } },
  });

  await createAuditLog({
    entityType: "PayrollMonth",
    entityId: id,
    action: "UPDATE",
    diff: parsed.data,
    performedByUserId: actor.id,
  });

  return jsonOk({ payroll: serializePayrollMonth(row) });
}
