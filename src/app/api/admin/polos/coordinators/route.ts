import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { poloCoordinatorEligibleWhere } from "@/lib/polo-coordinator-eligible";

/** Lista usuários elegíveis como coordenador de polo (papel ou overlay). */
export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);

  const users = await prisma.user.findMany({
    where: poloCoordinatorEligibleWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return jsonOk({ users });
}
