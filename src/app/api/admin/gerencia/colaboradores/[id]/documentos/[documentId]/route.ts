import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { employeeSelect, serializeEmployee } from "@/lib/employee-serialize";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string; documentId: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id: employeeId, documentId } = await ctx.params;
  const document = await prisma.employeeDocument.findFirst({
    where: { id: documentId, employeeId, deletedAt: null },
    select: { id: true, type: true },
  });
  if (!document) {
    return jsonErr("NOT_FOUND", "Documento não encontrado.", 404);
  }

  await prisma.employeeDocument.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    entityType: "Employee",
    entityId: employeeId,
    action: "DOCUMENT_REMOVED",
    diff: { type: document.type },
    performedByUserId: actor.id,
  });

  const updated = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: employeeSelect,
  });
  return jsonOk({ employee: serializeEmployee(updated) });
}
