import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { employeeSelect, serializeEmployee } from "@/lib/employee-serialize";
import { referenceMonthToDate } from "@/lib/employees";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createEmployeeDocumentSchema } from "@/lib/validators/employees";

type Ctx = { params: Promise<{ id: string }> };

/** Um documento por tipo, exceto notas mensais (uma por competência) e "Outro". */
function replacesPrevious(type: string): boolean {
  return type !== "NOTA_MENSAL" && type !== "OUTRO";
}

export async function POST(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id: employeeId } = await ctx.params;
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) {
    return jsonErr("NOT_FOUND", "Colaborador não encontrado.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = createEmployeeDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { type, title, referenceMonth, amount, publicId, url, fileName, mimeType, sizeBytes } =
    parsed.data;
  const referenceMonthDate = referenceMonth ? referenceMonthToDate(referenceMonth) : null;
  if (referenceMonth && !referenceMonthDate) {
    return jsonErr("VALIDATION_ERROR", "Competência inválida (use MM/AAAA).", 400);
  }

  await prisma.$transaction(async (tx) => {
    if (replacesPrevious(type)) {
      await tx.employeeDocument.updateMany({
        where: { employeeId, type, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    } else if (type === "NOTA_MENSAL" && referenceMonthDate) {
      await tx.employeeDocument.updateMany({
        where: { employeeId, type, referenceMonth: referenceMonthDate, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }
    await tx.employeeDocument.create({
      data: {
        employeeId,
        type,
        title: title ?? null,
        referenceMonth: referenceMonthDate,
        amountCents: amount ?? null,
        publicId,
        url,
        fileName: fileName ?? null,
        mimeType: mimeType ?? null,
        sizeBytes: sizeBytes ?? null,
        uploadedByUserId: actor.id,
      },
    });
  });

  await createAuditLog({
    entityType: "Employee",
    entityId: employeeId,
    action: "DOCUMENT_ADDED",
    diff: { type, referenceMonth },
    performedByUserId: actor.id,
  });

  const updated = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: employeeSelect,
  });
  return jsonOk({ employee: serializeEmployee(updated) }, { status: 201 });
}
