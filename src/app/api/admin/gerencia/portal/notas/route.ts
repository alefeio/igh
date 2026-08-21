import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager, requireAdminManagerWrite } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  approveInvoiceSubmission,
  notifyAdminManagers,
  serializeInvoiceSubmission,
  submissionInclude,
} from "@/lib/employee-portal";
import { ensureEmployeeInvoiceDueReminders } from "@/lib/employee-invoice-reminders";
import { formatReferenceMonth, referenceMonthToDate } from "@/lib/employees";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { EmployeeInvoiceSubmissionStatus } from "@/generated/prisma/client";
import { adminCreateInvoiceSubmissionSchema } from "@/lib/validators/employee-portal";

export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  void ensureEmployeeInvoiceDueReminders().catch(() => undefined);

  const status = new URL(request.url).searchParams.get("status");
  const allowed: EmployeeInvoiceSubmissionStatus[] = ["PENDENTE", "APROVADA", "RECUSADA"];
  const where =
    status && allowed.includes(status as EmployeeInvoiceSubmissionStatus)
      ? { status: status as EmployeeInvoiceSubmissionStatus }
      : {};

  const [rows, overdueMonthly] = await Promise.all([
    prisma.employeeInvoiceSubmission.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: submissionInclude,
      take: 200,
    }),
    prisma.employeeMonthlyInvoice.count({
      where: { deletedAt: null, status: "ATRASADA" },
    }),
  ]);

  return jsonOk({
    submissions: rows.map(serializeInvoiceSubmission),
    overdueMonthly,
  });
}

/** Gerência registra NF em nome do colaborador (mesma fila do portal). */
export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAdminManagerWrite();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = adminCreateInvoiceSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const referenceMonth = referenceMonthToDate(parsed.data.referenceMonth);
  if (!referenceMonth) {
    return jsonErr("VALIDATION_ERROR", "Competência inválida (use AAAA-MM).", 400);
  }

  const employee = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, deletedAt: null, status: { not: "DESLIGADO" } },
    select: { id: true, name: true, userId: true },
  });
  if (!employee) return jsonErr("NOT_FOUND", "Colaborador não encontrado.", 404);

  const row = await prisma.employeeInvoiceSubmission.create({
    data: {
      employeeId: employee.id,
      referenceMonth,
      amountCents: parsed.data.amount ?? null,
      description: parsed.data.description ?? null,
      supplier: parsed.data.supplier ?? null,
      invoiceNumber: parsed.data.invoiceNumber ?? null,
      fileUrl: parsed.data.fileUrl,
      filePublicId: parsed.data.filePublicId ?? null,
      fileName: parsed.data.fileName ?? null,
    },
    include: submissionInclude,
  });

  await createAuditLog({
    entityType: "EmployeeInvoiceSubmission",
    entityId: row.id,
    action: "CREATE",
    diff: {
      employeeId: employee.id,
      referenceMonth: parsed.data.referenceMonth,
      byAdmin: true,
      autoApprove: parsed.data.autoApprove,
    },
    performedByUserId: actor.id,
  });

  if (parsed.data.autoApprove) {
    try {
      const approved = await approveInvoiceSubmission({
        submissionId: row.id,
        actorId: actor.id,
        reviewNotes: parsed.data.reviewNotes ?? "Registrada pela gerência.",
        createFinancialEntry: parsed.data.createFinancialEntry,
      });
      return jsonOk({ submission: serializeInvoiceSubmission(approved) }, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "AMOUNT_REQUIRED") {
        return jsonErr(
          "VALIDATION_ERROR",
          "Informe o valor da nota para aprovar e lançar no financeiro.",
          400,
        );
      }
      throw e;
    }
  }

  await notifyAdminManagers({
    kind: "EMPLOYEE_INVOICE_SUBMITTED",
    title: "NF registrada pela gerência",
    body: `${actor.name} registrou a nota de ${employee.name} (${formatReferenceMonth(referenceMonth)}).`,
    linkUrl: "/admin/gerencia/portal",
    dedupeKey: `employee-invoice-submitted:${row.id}`,
    exceptUserId: actor.id,
  });

  return jsonOk({ submission: serializeInvoiceSubmission(row) }, { status: 201 });
}
