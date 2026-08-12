/**
 * Seed dos Modelos oficiais da Gerência (contrato, distrato, termo de doação).
 * Executar: npm run seed:modelos
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { applyDocumentTemplatesV1Seed } from "./seeds/apply-document-templates-v1";

async function main() {
  await prisma.$connect();
  await applyDocumentTemplatesV1Seed(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Erro no seed de modelos:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
