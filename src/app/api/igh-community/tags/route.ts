import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/** Sugestões de tags — leitura pública (usada ao criar publicações autenticadas). */
export async function GET() {
  const tags = await prisma.ighCommunityTag.findMany({
    orderBy: { name: "asc" },
    take: 200,
    select: { name: true },
  });

  return jsonOk({ tags: tags.map((t) => t.name) });
}
