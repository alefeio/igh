import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";

/**
 * GET /api/site/formations
 * Público: retorna formações com apenas cursos ACTIVE (cursos NOT_LISTED e INACTIVE não aparecem no site).
 */
export async function GET() {
  const items = await prisma.siteFormation.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }],
    include: {
      courses: {
        where: { course: { status: "ACTIVE" } },
        include: { course: true },
        orderBy: [{ order: "asc" }],
      },
    },
  });
  return jsonOk({ items });
}
