/**
 * Atualiza os guias de onboarding (título + conteúdo) para TODOS os perfis.
 * Sobrescreve o que estiver no banco — use após evoluir `seeds/onboarding-guides.ts`.
 *
 * Executar: npm run seed:onboarding
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { upsertAllOnboardingGuidesFromRepo } from "./seeds/upsert-onboarding-from-repo";

async function main() {
  await prisma.$connect();
  await upsertAllOnboardingGuidesFromRepo(prisma);
  console.log("Seed de onboarding (todos os perfis) concluído.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Erro no seed de onboarding:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
