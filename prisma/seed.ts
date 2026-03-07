/**
 * Seed desativado. Os seeds anteriores foram removidos para não sobrescrever
 * dados inseridos manualmente (ex.: conteúdo das aulas).
 * Para criar novos seeds no futuro, edite este arquivo ou adicione scripts em prisma/seeds/.
 *
 * Executar: npm run seed (ou npx prisma db seed)
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  // Nenhum dado é inserido. Adicione aqui novos seeds conforme a necessidade.
  await prisma.$connect();
}

main()
  .then(() => {
    console.log("Seed concluído (nenhum dado inserido).");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
