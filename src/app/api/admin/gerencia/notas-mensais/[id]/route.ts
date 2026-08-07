import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateMonthlyInvoiceSchema } from "@/lib/validators/admin-documents";

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
  const existing = await prisma.employeeMonthlyInvoice.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Nota não encontrada.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateMonthlyInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const invoice = await prisma.employeeMonthlyInvoice.update({
    where: { id },
    data: {
      amountCents: parsed.data.amount === undefined ? undefined : parsed.data.amount,
      status: parsed.data.status,
      notes: parsed.data.notes === undefined ? undefined : parsed.data.notes,
      pdfUrl: parsed.data.pdfUrl === undefined ? undefined : parsed.data.pdfUrl,
      pdfPublicId: parsed.data.pdfPublicId === undefined ? undefined : parsed.data.pdfPublicId,
      issuedAt: parsed.data.issuedAt === undefined ? undefined : parsed.data.issuedAt,
    },
    include: {
      employee: {
        select: { id: true, name: true, cpf: true, position: true, positionLabel: true },
      },
    },
  });

  await createAuditLog({
    entityType: "EmployeeMonthlyInvoice",
    entityId: id,
    action: "UPDATE",
    diff: { fields: Object.keys(parsed.data) },
    performedByUserId: actor.id,
  });

  return jsonOk({
    invoice: {
      ...invoice,
      referenceMonth: invoice.referenceMonth.toISOString().slice(0, 10),
      issuedAt: invoice.issuedAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    },
  });
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
  const existing = await prisma.employeeMonthlyInvoice.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Nota não encontrada.", 404);

  await prisma.employeeMonthlyInvoice.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    entityType: "EmployeeMonthlyInvoice",
    entityId: id,
    action: "ARCHIVE",
    diff: {},
    performedByUserId: actor.id,
  });

  return jsonOk({ archived: true });
}
