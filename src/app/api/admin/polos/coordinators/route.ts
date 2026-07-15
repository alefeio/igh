import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

/** Lista usuários elegíveis como coordenador de polo (papel POLO_COORDINATOR). */
export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);

  const users = await prisma.user.findMany({
    where: { role: "POLO_COORDINATOR", isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return jsonOk({ users });
}
