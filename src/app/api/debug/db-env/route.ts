import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { getPrismaConnectionDebugInfo } from "@/lib/prisma";

export async function GET() {
  await requireRole(["MASTER", "ADMIN"]);
  return jsonOk({ prisma: getPrismaConnectionDebugInfo() });
}

