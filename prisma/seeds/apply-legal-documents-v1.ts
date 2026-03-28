import type { PrismaClient } from "../../src/generated/prisma/client";
import { LEGAL_DOCUMENTS_V1 } from "./legal-documents-v1";

/**
 * Cria a primeira versão publicada (1.0) de cada documento legal **apenas se**
 * ainda não existir nenhum registo para aquele `kind`.
 */
export async function applyLegalDocumentsV1Seed(db: PrismaClient) {
  for (const doc of LEGAL_DOCUMENTS_V1) {
    const existing = await db.legalDocumentVersion.findFirst({
      where: { kind: doc.kind },
      select: { id: true },
    });
    if (existing) {
      console.log(`Legal ${doc.kind}: já existe versão; seed omitido.`);
      continue;
    }

    const publishedAt = new Date();
    await db.legalDocumentVersion.create({
      data: {
        kind: doc.kind,
        versionLabel: doc.versionLabel,
        title: doc.title,
        contentRich: doc.contentRich,
        status: "PUBLISHED",
        publishedAt,
      },
    });
    console.log(`Legal ${doc.kind}: versão ${doc.versionLabel} publicada (seed inicial).`);
  }
}
