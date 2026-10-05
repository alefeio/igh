import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

/** Lista todos os polos cadastrados para filtros (matrículas, turmas, etc.). */
export async function GET() {
  await requireRole(["ADMIN", "MASTER", "GENERAL_ADMIN", "TEACHER", "POLO_COORDINATOR"]);

  const polos = await prisma.polo.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return jsonOk({ polos });
}
