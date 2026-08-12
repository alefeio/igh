import { authErrorResponse } from "@/lib/api-auth-guard";
import { createAuditLog } from "@/lib/audit";
import {
  cleaningReportInclude,
  notifyAdminManagers,
  requireEmployeePortalPosition,
  serializeCleaningReport,
} from "@/lib/employee-portal";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createCleaningReportSchema } from "@/lib/validators/employee-portal";

export async function GET() {
  try {
    const { employee } = await requireEmployeePortalPosition("LIMPEZA");
    const rows = await prisma.employeeCleaningReport.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      include: cleaningReportInclude,
      take: 100,
    });
    return jsonOk({ reports: rows.map(serializeCleaningReport) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireEmployeePortalPosition("LIMPEZA");
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createCleaningReportSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const inventoryIds = parsed.data.lines
    .map((l) => l.inventoryItemId)
    .filter((id): id is string => Boolean(id));
  if (inventoryIds.length) {
    const found = await prisma.inventoryItem.findMany({
      where: { id: { in: inventoryIds }, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (found.length !== new Set(inventoryIds).size) {
      return jsonErr("VALIDATION_ERROR", "Um ou mais itens do estoque são inválidos.", 400);
    }
  }

  const row = await prisma.employeeCleaningReport.create({
    data: {
      employeeId: ctx.employee.id,
      notes: parsed.data.notes ?? null,
      lines: {
        create: parsed.data.lines.map((line) => ({
          inventoryItemId: line.inventoryItemId ?? null,
          itemName: line.itemName,
          kind: line.kind,
          quantity: line.quantity,
          notes: line.notes ?? null,
        })),
      },
    },
    include: cleaningReportInclude,
  });

  await createAuditLog({
    entityType: "EmployeeCleaningReport",
    entityId: row.id,
    action: "CREATE",
    diff: { lines: parsed.data.lines.length },
    performedByUserId: ctx.user.id,
  });

  await notifyAdminManagers({
    kind: "EMPLOYEE_CLEANING_REPORT",
    title: "Relato de limpeza",
    body: `${ctx.employee.name} enviou um relato de materiais (${parsed.data.lines.length} item(ns)).`,
    linkUrl: "/admin/gerencia/portal?tab=limpeza",
    dedupeKey: `employee-cleaning-report:${row.id}`,
    exceptUserId: ctx.user.id,
  });

  return jsonOk({ report: serializeCleaningReport(row) }, { status: 201 });
}
