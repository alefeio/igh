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
            "Matrícula é o vínculo em uma turma. Não se divide em pré-matrícula e confirmada: quem ainda não confirma no sistema assiste às aulas. Pessoa atendida é quem teve pelo menos uma presença no recorte.",
        },
        {
          term: "Suspensão por faltas",
          definition:
            "Três faltas consecutivas sem justificativa levam à suspensão; a quarta, ao cancelamento. Suspensos entram nas métricas como alerta.",
        },
        {
          term: "Risco crítico por faltas",
          definition:
            "Matrículas ativas ou suspensas com quatro ou mais faltas consecutivas sem justificativa. Não é evasão confirmada.",
        },
        {
          term: "Evasão confirmada",
          definition:
            "Só existirá com motivo de saída e histórico de status. Ainda não está disponível. Não use o risco por faltas como evasão.",
        },
        {
          term: "Frequência",
          definition:
            "Taxas sobre aulas já liberadas, até a data de atualização dos dados, após a entrada do aluno. Chamada sem lançamento não vira falta automática.",
        },
        {
          term: "Conclusão",
          definition: "Entre quem iniciou ( ≥1 presença ) em turmas ENCERRADAS. Não usa todas as matrículas como denominador principal.",
        },
        {
          term: "Ocupação atual",
          definition: "Vagas ocupadas agora (matrículas ativas ou suspensas) sobre a capacidade. Não é a ocupação do primeiro dia.",
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
            "Alcance = pessoas atendidas, concluintes, doações confirmadas. Emprego, renda e egressos ainda não são coletados.",
        },
        {
          term: "Zero, indisponível e qualidade parcial",
          definition:
            "Zero é quantidade medida. Indisponível é ausência de modelo ou dado. Parcial indica fórmula calculada com lacunas (ex.: chamada incompleta).",
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
