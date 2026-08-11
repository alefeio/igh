import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { serializeInvoiceSubmission, submissionInclude } from "@/lib/employee-portal";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { EmployeeInvoiceSubmissionStatus } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const status = new URL(request.url).searchParams.get("status");
  const allowed: EmployeeInvoiceSubmissionStatus[] = ["PENDENTE", "APROVADA", "RECUSADA"];
  const where =
    status && allowed.includes(status as EmployeeInvoiceSubmissionStatus)
      ? { status: status as EmployeeInvoiceSubmissionStatus }
      : {};

  const rows = await prisma.employeeInvoiceSubmission.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: submissionInclude,
    take: 200,
  });

  return jsonOk({ submissions: rows.map(serializeInvoiceSubmission) });
}
