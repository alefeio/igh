import { Prisma } from "@/generated/prisma/client";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonErr, jsonOk } from "@/lib/http";
import { employeeSelect, serializeEmployee } from "@/lib/employee-serialize";
import { prisma } from "@/lib/prisma";
import { createEmployeeSchema } from "@/lib/validators/employees";

export async function GET() {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: employeeSelect,
  });

  return jsonOk({ employees: employees.map(serializeEmployee) });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { monthlyPay, userId, poloId, ...rest } = parsed.data;

  if (userId) {
    const linked = await prisma.employee.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (linked) {
      return jsonErr(
        "USER_ALREADY_LINKED",
        `Esta conta já está vinculada ao colaborador ${linked.name}.`,
        409,
      );
    }
  }

  try {
    const employee = await prisma.employee.create({
      data: {
        ...rest,
        userId: userId ?? null,
        poloId: poloId ?? null,
        monthlyPayCents: monthlyPay ?? null,
        createdByUserId: actor.id,
      },
      select: employeeSelect,
    });

    await createAuditLog({
      entityType: "Employee",
      entityId: employee.id,
      action: "CREATE",
      diff: { name: employee.name, position: employee.position, status: employee.status },
      performedByUserId: actor.id,
    });

    return jsonOk({ employee: serializeEmployee(employee) }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonErr("CPF_IN_USE", "Já existe um colaborador com este CPF.", 409);
    }
    throw e;
  }
}
