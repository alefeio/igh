import { requireDirectorRead } from "@/lib/diretor/auth";
import { listMetricsForGuide } from "@/lib/diretor/catalog/definitions";
import { FORMULA_VERSION_1A } from "@/lib/diretor/catalog/definitions";
import { jsonErr, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const { viewer } = await requireDirectorRead();
    return jsonOk({
      meta: {
        generatedAt: new Date().toISOString(),
        dataAsOf: new Date().toISOString(),
        filters: {},
        quality: [{ domain: "guide", status: "ok" as const }],
        formulaVersion: FORMULA_VERSION_1A,
        viewer,
      },
      metrics: listMetricsForGuide(),
      glossary: [
        {
          term: "Risco crítico por faltas",
          definition:
            "Matrículas ainda vinculadas (ACTIVE/SUSPENDED) com streak ≥4 faltas consecutivas sem justificativa. Não é evasão confirmada.",
        },
        {
          term: "Evasão confirmada",
          definition:
            "Reservada para quando houver motivo de saída e histórico de status confiáveis. Não usada na Fase 1A.",
        },
        {
          term: "Oportunidade elegível",
          definition:
            "Par aluno×sessão com sessão LIBERADA, instante ≤ dataAsOf e após a entrada do aluno na turma.",
        },
        {
          term: "Aluno efetivamente atendido",
          definition: "studentId distinto com pelo menos uma presença elegível no recorte.",
        },
      ],
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return jsonErr("FORBIDDEN", "Acesso restrito ao perfil Diretor (ou preview Master).", 403);
    }
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return jsonErr("UNAUTHENTICATED", "Não autenticado.", 401);
    }
    console.error("[diretor/guide]", e);
    return jsonErr("INTERNAL", "Falha ao carregar o guia.", 500);
  }
}
