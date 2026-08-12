import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { driverLogInclude, serializeDriverLog } from "@/lib/employee-portal";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { EmployeePortalReviewStatus } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const status = new URL(request.url).searchParams.get("status");
  const allowed: EmployeePortalReviewStatus[] = ["PENDENTE", "VISTO"];
  const where =
    status && allowed.includes(status as EmployeePortalReviewStatus)
      ? { status: status as EmployeePortalReviewStatus }
      : {};

  const rows = await prisma.employeeDriverLog.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: driverLogInclude,
    take: 200,
  });

  return jsonOk({ logs: rows.map(serializeDriverLog) });
}
