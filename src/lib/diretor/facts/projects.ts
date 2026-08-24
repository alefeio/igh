import "server-only";

import { cachedDirector } from "@/lib/diretor/cache";
import type { ProjectExecutiveFacts } from "@/lib/diretor/facts/types";

export async function loadProjectExecutiveFacts(viewer: "DIRECTOR" | "MASTER"): Promise<ProjectExecutiveFacts> {
  void viewer;
  return cachedDirector(["facts-projects"], async () => ({
    unavailable: true as const,
    periodLabel: String(new Date().getUTCFullYear()),
    quality: [
      {
        domain: "projects",
        status: "unavailable" as const,
        note: "Cadastro de projetos/convênios institucionais inexistente.",
      },
    ],
    qualityNotes: ["Portfólio de projetos não modelado — nenhum zero exibido como quantidade real."],
  }));
}
