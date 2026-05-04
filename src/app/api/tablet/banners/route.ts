import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/http";

/**
 * GET /api/tablet/banners
 * Público: retorna apenas banners ativos (mesmos cadastrados em Admin → Banners (aluno))
 * para a vitrine em tela cheia /tablet/banners e para o topo do painel do aluno no /dashboard.
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
      linkHref: true,
      order: true,
      isActive: true,
    },
  });
  return jsonOk({ items });
}
