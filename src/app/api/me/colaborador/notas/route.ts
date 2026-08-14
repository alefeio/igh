import { authErrorResponse } from "@/lib/api-auth-guard";
import { createAuditLog } from "@/lib/audit";
import {
  getEmployeeBankCheck,
  notifyAdminManagers,
  requireEmployeePortal,
  serializeInvoiceSubmission,
  submissionInclude,
} from "@/lib/employee-portal";
import { serializeBankMismatchDetails } from "@/lib/employee-invoice-bank";
import { formatReferenceMonth, referenceMonthToDate } from "@/lib/employees";
import { readInvoiceAttachment } from "@/lib/financeiro-invoice-read";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createInvoiceSubmissionSchema } from "@/lib/validators/employee-portal";

export async function GET() {
  try {
    const { employee } = await requireEmployeePortal();
    const rows = await prisma.employeeInvoiceSubmission.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      include: submissionInclude,
      take: 100,
    });
    return jsonOk({ submissions: rows.map(serializeInvoiceSubmission) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireEmployeePortal();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createInvoiceSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const referenceMonth = referenceMonthToDate(parsed.data.referenceMonth);
  if (!referenceMonth) {
    return jsonErr("VALIDATION_ERROR", "Competência inválida (use AAAA-MM).", 400);
  }

  let bankCheck = await getEmployeeBankCheck(ctx.employee.id, {});
  try {
    const read = await readInvoiceAttachment({
      attachmentUrl: parsed.data.fileUrl,
      attachmentFileName: parsed.data.fileName,
    });
    bankCheck = await getEmployeeBankCheck(ctx.employee.id, read.suggestion);
  } catch (e) {
    console.error("[colaborador/notas] bank check read failed:", e);
  }

  const hasMismatch = bankCheck.hasExtractedBankData && bankCheck.mismatches.length > 0;
  if (hasMismatch && !parsed.data.acknowledgeBankMismatch) {
    return jsonErr(
      "BANK_MISMATCH",
      "Os dados bancários da nota divergem do seu cadastro. Confirme para enviar mesmo assim.",
      409,
      bankCheck,
    );
  }

  const row = await prisma.employeeInvoiceSubmission.create({
    data: {
      employeeId: ctx.employee.id,
      referenceMonth,
      amountCents: parsed.data.amount ?? null,
      description: parsed.data.description ?? null,
      supplier: parsed.data.supplier ?? null,
      invoiceNumber: parsed.data.invoiceNumber ?? null,
      fileUrl: parsed.data.fileUrl,
      filePublicId: parsed.data.filePublicId ?? null,
      fileName: parsed.data.fileName ?? null,
      bankMismatch: hasMismatch,
      bankMismatchDetails: hasMismatch ? serializeBankMismatchDetails(bankCheck) : null,
      bankMismatchAcknowledgedAt: hasMismatch ? new Date() : null,
    },
    include: submissionInclude,
  });

  await createAuditLog({
    entityType: "EmployeeInvoiceSubmission",
    entityId: row.id,
    action: "CREATE",
    diff: {
      employeeId: ctx.employee.id,
      referenceMonth: parsed.data.referenceMonth,
      bankMismatch: hasMismatch,
    },
    performedByUserId: ctx.user.id,
  });

  await notifyAdminManagers({
    kind: "EMPLOYEE_INVOICE_SUBMITTED",
    title: "Nova nota fiscal no portal",
    body: `${ctx.employee.name} enviou a nota de ${formatReferenceMonth(referenceMonth)}.`,
    linkUrl: "/admin/gerencia/portal",
    dedupeKey: `employee-invoice-submitted:${row.id}`,
    exceptUserId: ctx.user.id,
  });

  if (hasMismatch) {
    const mismatchList = bankCheck.mismatches.slice(0, 6).join(" · ");
    await notifyAdminManagers({
      kind: "EMPLOYEE_INVOICE_BANK_MISMATCH",
      title: "Divergência bancária na NF do colaborador",
      body: `${ctx.employee.name} confirmou o envio da nota de ${formatReferenceMonth(referenceMonth)} com dados bancários diferentes do cadastro. ${mismatchList}`,
      linkUrl: "/admin/gerencia/portal",
      dedupeKey: `employee-invoice-bank-mismatch:${row.id}`,
      exceptUserId: ctx.user.id,
    });
  }

  return jsonOk({ submission: serializeInvoiceSubmission(row) }, { status: 201 });
}
