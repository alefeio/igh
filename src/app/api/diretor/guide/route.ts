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
            "Matrícula é o vínculo em uma turma. Pessoa atendida é o studentId com pelo menos uma presença em sessão elegível. Uma pessoa pode ter várias matrículas.",
        },
        {
          term: "Risco crítico por faltas",
          definition:
            "Matrículas ainda vinculadas (ACTIVE/SUSPENDED) com streak ≥4 faltas consecutivas sem justificativa. Não é evasão confirmada.",
        },
        {
          term: "Evasão confirmada",
          definition:
            "Só existirá com motivo de saída e histórico de status. Ainda não está disponível. Não use o risco por faltas como evasão.",
        },
        {
          term: "Frequência",
          definition:
            "Taxas sobre oportunidades elegíveis (aluno × sessão LIBERADA, ≤ dataAsOf, após a entrada). Chamada sem lançamento não vira falta automática.",
        },
        {
          term: "Conclusão",
          definition: "Entre quem iniciou ( ≥1 presença ) em turmas ENCERRADAS. Não usa todos os confirmados como denominador principal.",
        },
        {
          term: "Ocupação atual",
          definition: "Vagas ocupadas agora (ACTIVE+SUSPENDED) sobre capacidade. Não é ocupação no primeiro dia.",
        },
        {
          term: "Lançamentos pagos vs saldo bancário",
          definition:
            "Receitas/despesas pagas usam paidAt. Isso não é saldo, caixa nem disponibilidade financeira.",
        },
        {
          term: "Idade do lançamento em aberto vs vencimento",
          definition:
            "idadeEmAberto = dataAsOf − entryDate. Mede há quanto tempo o registro está aberto. O sistema não tem campo dueDate; não chame isso de vencido ou inadimplência.",
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
          term: "Data de referência (dataAsOf)",
          definition: "Instante usado para decidir o que já ocorreu. Não é a data de geração do arquivo.",
        },
        {
          term: "Projetos e convênios",
          definition:
            "Não há cadastro institucional. PaymentAgreement da Gerência é kanban de pagamento de pessoas, não convênio. A página informa indisponibilidade — não um portfólio zerado.",
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
