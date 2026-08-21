import { Prisma } from "@/generated/prisma/client";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { employeeSelect, serializeEmployee } from "@/lib/employee-serialize";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateEmployeeSchema } from "@/lib/validators/employees";

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
  const employee = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    select: employeeSelect,
  });
  if (!employee) {
    return jsonErr("NOT_FOUND", "Colaborador não encontrado.", 404);
  }

  return jsonOk({ employee: serializeEmployee(employee) });
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
  const existing = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, terminationDate: true },
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Colaborador não encontrado.", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { monthlyPay, offBooksPay, userId, poloId, ...rest } = parsed.data;

  if (userId) {
    const linked = await prisma.employee.findFirst({
      where: { userId, deletedAt: null, id: { not: id } },
      select: { name: true },
    });
    if (linked) {
      return jsonErr(
        "USER_ALREADY_LINKED",
        `Esta conta já está vinculada ao colaborador ${linked.name}.`,
        409,
      );
    }
  }

  const data: Prisma.EmployeeUpdateInput = { ...rest };
  if (monthlyPay !== undefined) data.monthlyPayCents = monthlyPay;
  if (offBooksPay !== undefined) data.offBooksPayCents = offBooksPay;
  if (userId !== undefined) {
    data.user = userId ? { connect: { id: userId } } : { disconnect: true };
  }
  if (poloId !== undefined) {
    data.polo = poloId ? { connect: { id: poloId } } : { disconnect: true };
  }

  try {
    const employee = await prisma.employee.update({
      where: { id },
      data,
      select: employeeSelect,
    });

    await createAuditLog({
      entityType: "Employee",
      entityId: id,
      action: "UPDATE",
      diff: { fields: Object.keys(parsed.data) },
      performedByUserId: actor.id,
    });

    return jsonOk({ employee: serializeEmployee(employee) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonErr("CPF_IN_USE", "Já existe um colaborador com este CPF.", 409);
    }
    throw e;
  }
}

/**
 * Exclusão em dois passos: primeiro arquiva (soft delete); `?permanent=true`
 * remove a ficha e os anexos de vez.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const permanent = new URL(request.url).searchParams.get("permanent") === "true";

  const existing = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Colaborador não encontrado.", 404);
  }

  if (permanent) {
    if (!existing.deletedAt) {
      return jsonErr(
        "INVALID_STATE",
        "Arquive o colaborador antes de excluir definitivamente.",
        400,
      );
    }
    await prisma.employee.delete({ where: { id } });
    await createAuditLog({
      entityType: "Employee",
      entityId: id,
      action: "DELETE",
      diff: { permanent: true, name: existing.name },
      performedByUserId: actor.id,
    });
    return jsonOk({ deleted: true });
  }

  await prisma.employee.update({
    where: { id },
    data: { deletedAt: new Date(), deletedByUserId: actor.id },
  });
  await createAuditLog({
    entityType: "Employee",
    entityId: id,
    action: "ARCHIVE",
    diff: { name: existing.name },
    performedByUserId: actor.id,
  });

  return jsonOk({ archived: true });
}
