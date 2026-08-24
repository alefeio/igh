import { requireDirectorRead } from "@/lib/diretor/auth";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { REPORT_CATALOG } from "@/lib/diretor/reports/generate";
import { jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const { viewer } = await requireDirectorRead();
    return jsonOk({
      meta: {
        generatedAt: new Date().toISOString(),
        dataAsOf: new Date().toISOString(),
        filters: {},
        quality: [{ domain: "overview", status: "ok" as const }],
        formulaVersion: "1B.0.0",
        viewer,
      },
      catalog: REPORT_CATALOG,
      formats: ["pdf", "xlsx", "csv", "json"],
      notes: [
        "Gere relatórios consolidados com os mesmos indicadores apresentados na área da Direção. Escolha o período e o formato desejado.",
        "Os arquivos seguem os filtros de ciclo e competência selecionados. Não há relatório de portfólio de projetos enquanto o cadastro institucional não existir.",
      ],
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
