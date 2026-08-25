import { requireDirectorRead } from "@/lib/diretor/auth";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { REPORT_CATALOG } from "@/lib/diretor/reports/generate";
import { defaultCompetence } from "@/lib/diretor/period";
import { jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const { viewer } = await requireDirectorRead();
    const competence = defaultCompetence();
    return jsonOk({
      meta: {
        generatedAt: new Date().toISOString(),
        dataAsOf: new Date().toISOString(),
        filters: { competence, defaultCompetence: competence },
        quality: [{ domain: "overview", status: "ok" as const }],
        formulaVersion: "1C.1.0",
        viewer,
      },
      catalog: REPORT_CATALOG,
      formats: ["pdf", "xlsx", "csv", "json"],
      notes: [
        "Os arquivos seguem os filtros de ciclo e competência selecionados. Não há relatório de portfólio de projetos enquanto o cadastro institucional não existir.",
      ],
      defaultCompetence: competence,
    });
  } catch (e) {
    return directorApiError(e);
  }
}
export function POST() {
  return methodNotAllowed();
}
export function PATCH() {
  return methodNotAllowed();
}
export function DELETE() {
  return methodNotAllowed();
}
