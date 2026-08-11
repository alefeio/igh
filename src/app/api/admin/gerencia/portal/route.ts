import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const [pendingInvoices, unreadThreads, openThreads] = await Promise.all([
    prisma.employeeInvoiceSubmission.count({ where: { status: "PENDENTE" } }),
    prisma.employeePortalThread.count({ where: { unreadByManager: true } }),
    prisma.employeePortalThread.count({ where: { status: "ABERTA" } }),
  ]);

  return jsonOk({ pendingInvoices, unreadThreads, openThreads });
}
