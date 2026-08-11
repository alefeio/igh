import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { serializeThreadListItem, threadListSelect } from "@/lib/employee-portal";
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

  const rows = await prisma.employeePortalThread.findMany({
    orderBy: [{ unreadByManager: "desc" }, { updatedAt: "desc" }],
    select: threadListSelect,
    take: 200,
  });

  return jsonOk({ threads: rows.map((row) => serializeThreadListItem(row, "manager")) });
}
