/**
 * Apenas documentos legais v1 (Termos, Privacidade, Cookies).
 * Executar: npm run seed:legal
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { applyLegalDocumentsV1Seed } from "./seeds/apply-legal-documents-v1";

async function main() {
  await prisma.$connect();
  await applyLegalDocumentsV1Seed(prisma);
  console.log("Seed legal concluído.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Erro no seed legal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
