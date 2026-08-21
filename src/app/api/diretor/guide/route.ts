import { requireDirectorRead } from "@/lib/diretor/auth";
import { FORMULA_VERSION_1A, listMetricsForGuide } from "@/lib/diretor/catalog/definitions";
import { directorApiError, methodNotAllowed } from "@/lib/diretor/http";
import { jsonOk } from "@/lib/http";

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
          term: "Chamada incompleta",
          definition:
            "Oportunidade elegível sem SessionAttendance. Entra no denominador das taxas, não vira falta automática; eleva qualidade para parcial e reduz completude da chamada.",
        },
        {
          term: "Aluno efetivamente atendido",
          definition: "studentId distinto com pelo menos uma presença elegível no recorte.",
        },
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
