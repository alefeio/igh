import { authErrorResponse } from "@/lib/api-auth-guard";
import { employeePositionText } from "@/lib/employees";
import { requireEmployeePortal } from "@/lib/employee-portal";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateEmployeePortalProfileSchema } from "@/lib/validators/employee-portal";

export async function GET() {
  try {
    const { employee } = await requireEmployeePortal();
    const [pendingInvoices, unreadMessages] = await Promise.all([
      prisma.employeeInvoiceSubmission.count({
        where: { employeeId: employee.id, status: "PENDENTE" },
      }),
      prisma.employeePortalThread.count({
        where: { employeeId: employee.id, unreadByEmployee: true },
      }),
    ]);
    return jsonOk({
      employee: {
        id: employee.id,
        name: employee.name,
        status: employee.status,
        photoUrl: employee.photoUrl,
        position: employee.position,
        positionLabel: employeePositionText(employee),
      },
      pendingInvoices,
      unreadMessages,
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

export async function PATCH(request: Request) {
  let ctx;
  try {
    ctx = await requireEmployeePortal();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateEmployeePortalProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const employee = await prisma.employee.update({
    where: { id: ctx.employee.id },
    data: { photoUrl: parsed.data.photoUrl === undefined ? undefined : parsed.data.photoUrl },
    select: {
      id: true,
      name: true,
      status: true,
      photoUrl: true,
      position: true,
      positionLabel: true,
    },
  });

  return jsonOk({
    employee: {
      ...employee,
      positionLabel: employeePositionText(employee),
    },
  });
}
