/**
 * Seed opcional: preenche guias de onboarding por perfil (OnboardingGuide) apenas quando
 * não existe registo ou o conteúdo está vazio — não sobrescreve edições feitas no Admin.
 *
 * Para aplicar o conteúdo atual de `seeds/onboarding-guides.ts` a todos os perfis (sobrescreve
 * o banco), use um destes:
 *   - npm run seed:onboarding
 *   - UPDATE_ONBOARDING_SEED=1 npx prisma db seed   (Git Bash / macOS / Linux)
 *   - $env:UPDATE_ONBOARDING_SEED="1"; npx prisma db seed   (PowerShell)
 *
 * Documentos legais (primeira versão): ver também `npm run seed:legal` ou o passo automático no seed abaixo.
 *
 * Executar: npm run seed (ou npx prisma db seed)
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { applyLegalDocumentsV1Seed } from "./seeds/apply-legal-documents-v1";
import { ONBOARDING_GUIDES, ONBOARDING_ROLES_ORDER } from "./seeds/onboarding-guides";
import { upsertAllOnboardingGuidesFromRepo } from "./seeds/upsert-onboarding-from-repo";

function shouldForceOnboardingFromRepo() {
  const v = process.env.UPDATE_ONBOARDING_SEED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function seedOnboardingGuides() {
  if (shouldForceOnboardingFromRepo()) {
    console.log(
      "UPDATE_ONBOARDING_SEED ativo: a aplicar guias de prisma/seeds/onboarding-guides.ts a todos os perfis (sobrescreve o banco).\n",
    );
    await upsertAllOnboardingGuidesFromRepo(prisma);
    return;
  }

  for (const role of ONBOARDING_ROLES_ORDER) {
    const { title, contentRich } = ONBOARDING_GUIDES[role];
    const existing = await prisma.onboardingGuide.findUnique({
      where: { role },
      select: { id: true, contentRich: true },
    });

    if (!existing) {
      await prisma.onboardingGuide.create({
        data: { role, title, contentRich },
      });
      console.log(`Onboarding ${role}: registro criado com conteúdo padrão.`);
      continue;
    }

    if (!existing.contentRich?.trim()) {
      await prisma.onboardingGuide.update({
        where: { role },
        data: { title, contentRich },
      });
      console.log(`Onboarding ${role}: conteúdo padrão aplicado (estava vazio).`);
      continue;
    }

    console.log(`Onboarding ${role}: já possui conteúdo; nenhuma alteração.`);
  }
}

async function main() {
  await prisma.$connect();
  await applyLegalDocumentsV1Seed(prisma);
  await seedOnboardingGuides();
}

main()
  .then(() => {
    console.log("Seed concluído.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
