import { requireDirectorRead } from "@/lib/diretor/auth";
import { FORMULA_VERSION_1C, listMetricsForGuide } from "@/lib/diretor/catalog/definitions";
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
        formulaVersion: FORMULA_VERSION_1C,
        viewer,
      },
      metrics: listMetricsForGuide(),
      glossary: [
        {
          term: "Matrícula vs pessoa atendida",
          definition:
            "Matrícula é o vínculo em uma turma. Toda inscrição registrada conta. Pessoa atendida é quem teve pelo menos uma presença no recorte.",
        },
        {
          term: "Estoque atual vs histórico",
          definition:
            "Ocupação usa ativas e suspensas em turmas vigentes. Cancelamentos e conclusões são resultado do período e não ocupam vaga agora.",
        },
        {
          term: "Progressão de faltas",
          definition:
            "Duas faltas consecutivas sem justificativa: atenção preventiva. Três: suspensão. Quatro: cancelamento já processado. Sessão sem lançamento interrompe a sequência. Falta justificada não conta.",
        },
        {
          term: "Frequência",
          definition:
            "Taxas sobre aulas já liberadas, até a data de atualização dos dados, após a entrada do aluno. Chamada sem lançamento não vira falta automática. Abaixo de 90% de completude a leitura é provisória.",
        },
        {
          term: "Conclusão",
          definition:
            "Entre quem iniciou ( ≥1 presença ) em turmas ENCERRADAS. Não usa todas as matrículas como denominador principal.",
        },
        {
          term: "Ocupação atual",
          definition:
            "Vagas ocupadas agora (matrículas ativas ou suspensas em turmas abertas ou em andamento) sobre a capacidade.",
        },
        {
          term: "Lançamentos pagos vs saldo bancário",
          definition:
            "Receitas e despesas pagas usam a data do pagamento. Isso não é saldo, caixa nem disponibilidade financeira.",
        },
        {
          term: "Tempo em aberto do lançamento",
          definition:
            "Há quanto tempo o registro está aberto, da data do lançamento até a atualização dos dados. O sistema não registra vencimento; não chame isso de atraso ou inadimplência.",
        },
        {
          term: "Alcance social vs impacto de longo prazo",
          definition:
            "Alcance = pessoas atendidas, concluintes, doações registradas no ano. Emprego, renda e egressos ainda não são coletados.",
        },
        {
          term: "Zero, indisponível e qualidade parcial",
          definition:
            "Zero é quantidade medida quando a chamada está completa. Indisponível é ausência de modelo ou dado. Parcial indica fórmula calculada com lacunas. Com chamadas incompletas, zero de presença não é resultado executivo.",
        },
        {
          term: "Data de atualização dos dados",
          definition: "Instante usado para decidir o que já ocorreu. Não é a data de geração do arquivo.",
        },
        {
          term: "Projetos e convênios",
          definition:
            "Não há cadastro institucional de projetos. Os acordos de pagamento da gerência não são convênios. A página informa indisponibilidade — não um portfólio zerado.",
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
