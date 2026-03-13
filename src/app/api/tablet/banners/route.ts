import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";

/**
 * GET /api/tablet/banners
 * Público: retorna apenas banners ativos para exibição na tela de tablet (sem autenticação).
 */
export async function GET() {
  const items = await prisma.tabletBanner.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }],
    select: {
      id: true,
      title: true,
      subtitle: true,
      imageUrl: true,
      order: true,
      isActive: true,
    },
  });
  return jsonOk({ items });
}
