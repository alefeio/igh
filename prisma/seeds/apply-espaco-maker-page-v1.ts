import type { PrismaClient } from "../../src/generated/prisma/client";
import { ESPACO_MAKER_PAGE_SEED } from "./espaco-maker-page-v1";

/**
 * Cria o registro inicial da página Espaço Maker **apenas se** ainda não existir nenhum.
 * Não sobrescreve edições feitas no Admin.
 */
export async function applyEspacoMakerPageV1Seed(db: PrismaClient) {
  const existing = await db.siteEspacoMakerPage.findFirst({ select: { id: true } });
  if (existing) {
    console.log("Espaço Maker: página já existe; seed omitido.");
    return;
  }

  await db.siteEspacoMakerPage.create({
    data: {
      title: ESPACO_MAKER_PAGE_SEED.title,
      subtitle: ESPACO_MAKER_PAGE_SEED.subtitle,
      content: ESPACO_MAKER_PAGE_SEED.content,
      mediaUrls: [],
    },
  });
  console.log("Espaço Maker: conteúdo inicial criado (seed).");
}
