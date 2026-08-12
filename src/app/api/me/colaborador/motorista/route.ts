import { authErrorResponse } from "@/lib/api-auth-guard";
import { createAuditLog } from "@/lib/audit";
import {
  driverLogInclude,
  notifyAdminManagers,
  requireEmployeePortalPosition,
  serializeDriverLog,
} from "@/lib/employee-portal";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createDriverLogSchema } from "@/lib/validators/employee-portal";

export async function GET() {
  try {
    const { employee } = await requireEmployeePortalPosition("MOTORISTA");
    const rows = await prisma.employeeDriverLog.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      include: driverLogInclude,
      take: 100,
    });
    return jsonOk({ logs: rows.map(serializeDriverLog) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireEmployeePortalPosition("MOTORISTA");
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createDriverLogSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  if (parsed.data.kind === "NOTA_SERVICO" && !parsed.data.fileUrl) {
    return jsonErr("VALIDATION_ERROR", "Anexe o arquivo da nota de serviço.", 400);
  }

  const occurredAt = new Date(`${parsed.data.occurredAt}T12:00:00.000Z`);
  if (Number.isNaN(occurredAt.getTime())) {
    return jsonErr("VALIDATION_ERROR", "Data inválida.", 400);
  }

  const kindLabel =
    parsed.data.kind === "QUILOMETRAGEM"
      ? "quilometragem"
      : parsed.data.kind === "NOTA_SERVICO"
        ? "nota de serviço"
        : "ocorrência";

  const row = await prisma.employeeDriverLog.create({
    data: {
      employeeId: ctx.employee.id,
      kind: parsed.data.kind,
      occurredAt,
      odometerKm: parsed.data.odometerKm ?? null,
      description: parsed.data.description,
      amountCents: parsed.data.amount ?? null,
      supplier: parsed.data.supplier ?? null,
      invoiceNumber: parsed.data.invoiceNumber ?? null,
      fileUrl: parsed.data.fileUrl ?? null,
      filePublicId: parsed.data.filePublicId ?? null,
      fileName: parsed.data.fileName ?? null,
    },
    include: driverLogInclude,
  });

  await createAuditLog({
    entityType: "EmployeeDriverLog",
    entityId: row.id,
    action: "CREATE",
    diff: { kind: parsed.data.kind },
    performedByUserId: ctx.user.id,
  });

  await notifyAdminManagers({
    kind: "EMPLOYEE_DRIVER_LOG",
    title: "Registro do motorista",
    body: `${ctx.employee.name} enviou um registro de ${kindLabel}.`,
    linkUrl: "/admin/gerencia/portal?tab=motorista",
    dedupeKey: `employee-driver-log:${row.id}`,
    exceptUserId: ctx.user.id,
  });

  return jsonOk({ log: serializeDriverLog(row) }, { status: 201 });
}
