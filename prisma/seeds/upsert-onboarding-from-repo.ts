import type { PrismaClient } from "../../src/generated/prisma/client";
import { ONBOARDING_GUIDES, ONBOARDING_ROLES_ORDER } from "./onboarding-guides";

/** Aplica `onboarding-guides.ts` ao banco para todos os perfis (sobrescreve título e conteúdo). */
export async function upsertAllOnboardingGuidesFromRepo(db: PrismaClient) {
  for (const role of ONBOARDING_ROLES_ORDER) {
    const { title, contentRich } = ONBOARDING_GUIDES[role];
    await db.onboardingGuide.upsert({
      where: { role },
      create: { role, title, contentRich },
      update: { title, contentRich },
    });
    console.log(`Onboarding ${role}: conteúdo atualizado a partir do repositório.`);
  }
}
