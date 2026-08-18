import type { PrismaClient } from "../../src/generated/prisma/client";
import { DOCUMENT_TEMPLATES_V1 } from "./document-templates-v1";

/**
 * Cria os Modelos oficiais (contrato, distrato, termo de doação) **apenas se**
 * ainda não existir um modelo com o mesmo `type` + `title`.
 */
export async function applyDocumentTemplatesV1Seed(db: PrismaClient) {
  for (const tpl of DOCUMENT_TEMPLATES_V1) {
    const existing = await db.documentTemplate.findFirst({
      where: { type: tpl.type, title: tpl.title },
      select: { id: true },
    });
    if (existing) {
      if (tpl.type === "TERMO_DOACAO" && tpl.title === "Termo de doação de equipamentos") {
        await db.documentTemplate.update({
          where: { id: existing.id },
          data: { contentRich: tpl.contentRich },
        });
        console.log(`Modelo ${tpl.type} “${tpl.title}”: HTML alinhado ao termo oficial.`);
        continue;
      }
      console.log(`Modelo ${tpl.type} “${tpl.title}”: já existe; seed omitido.`);
      continue;
    }
    await db.documentTemplate.create({
      data: {
        type: tpl.type,
        title: tpl.title,
        contentRich: tpl.contentRich,
        isActive: true,
      },
    });
    console.log(`Modelo ${tpl.type} “${tpl.title}”: criado (seed inicial).`);
  }
}
