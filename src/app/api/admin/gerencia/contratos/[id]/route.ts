import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateEmployeeContractSchema } from "@/lib/validators/admin-documents";

type Ctx = { params: Promise<{ id: string }> };

const contractInclude = {
  employee: {
    select: { id: true, name: true, cpf: true, position: true, positionLabel: true, status: true },
  },
  template: { select: { id: true, title: true, type: true } },
  parentContract: { select: { id: true, startDate: true, monthlyValueCents: true } },
} as const;

export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const contract = await prisma.employeeContract.findFirst({
    where: { id, deletedAt: null },
    include: contractInclude,
  });
  if (!contract) return jsonErr("NOT_FOUND", "Contrato não encontrado.", 404);

  return jsonOk({
    contract: {
      ...contract,
      startDate: contract.startDate.toISOString().slice(0, 10),
      endDate: contract.endDate ? contract.endDate.toISOString().slice(0, 10) : null,
      issuedAt: contract.issuedAt?.toISOString() ?? null,
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
    },
  });
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

  const { id } = await ctx.params;
  const existing = await prisma.employeeContract.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Contrato não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = updateEmployeeContractSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const contract = await prisma.employeeContract.update({
    where: { id },
    data: {
      status: parsed.data.status,
      endDate: parsed.data.endDate === undefined ? undefined : parsed.data.endDate,
      description: parsed.data.description === undefined ? undefined : parsed.data.description,
      signedPdfUrl: parsed.data.signedPdfUrl === undefined ? undefined : parsed.data.signedPdfUrl,
      signedPdfPublicId:
        parsed.data.signedPdfPublicId === undefined ? undefined : parsed.data.signedPdfPublicId,
    },
    include: contractInclude,
  });

  await createAuditLog({
    entityType: "EmployeeContract",
    entityId: id,
    action: "UPDATE",
    diff: { fields: Object.keys(parsed.data) },
    performedByUserId: actor.id,
  });

  return jsonOk({
    contract: {
      ...contract,
      startDate: contract.startDate.toISOString().slice(0, 10),
      endDate: contract.endDate ? contract.endDate.toISOString().slice(0, 10) : null,
      issuedAt: contract.issuedAt?.toISOString() ?? null,
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
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
  const existing = await prisma.employeeContract.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Contrato não encontrado.", 404);

  await prisma.employeeContract.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    entityType: "EmployeeContract",
    entityId: id,
    action: "ARCHIVE",
    diff: {},
    performedByUserId: actor.id,
  });

  return jsonOk({ archived: true });
}
