/**
 * Seed idempotente: módulos e aulas do curso "IA para Criadores e Estudantes" (6 módulos, 16 aulas, 20h).
 * Conteúdo em JSON (formato TipTap/ProseMirror do RichTextEditor do projeto).
 */
import type { PrismaClient } from "../../src/generated/prisma/client";

const DURATION_MINUTES = 75; // 16 × 75 = 1200 min = 20h

/** Monta documento TipTap/ProseMirror: heading + bulletList (JSON string). */
function richDoc(title: string, bullets: string[]): string {
  const content: unknown[] = [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: title }],
    },
    {
      type: "bulletList",
      content: bullets.map((text) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text }],
          },
        ],
      })),
    },
  ];
  return JSON.stringify({ type: "doc", content });
}

type LessonSeed = {
  order: number;
  title: string;
  contentJson: string;
};

type ModuleSeed = {
  order: number;
  title: string;
  description?: string;
  lessons: LessonSeed[];
};

const MODULES_AND_LESSONS: ModuleSeed[] = [
  {
    order: 0,
    title: "Fundamentos da Inteligência Artificial",
    description: "O que é IA, como funcionam as ferramentas e uso responsável.",
    lessons: [
      {
        order: 0,
        title: "Introdução à Inteligência Artificial",
        contentJson: richDoc("Introdução à Inteligência Artificial", [
          "O que é IA",
          "Onde a IA está presente",
          "IA generativa x tradicional",
          "Exemplos práticos",
          "Debate sobre impacto da IA",
        ]),
      },
      {
        order: 1,
        title: "Como Funcionam as Ferramentas de IA",
        contentJson: richDoc("Como Funcionam as Ferramentas de IA", [
          "Conceito de modelo de linguagem",
          "Entrada (prompt) e saída",
          "Limitações da IA",
          "Demonstração prática",
        ]),
      },
      {
        order: 2,
        title: "Ética e Uso Responsável da IA",
        contentJson: richDoc("Ética e Uso Responsável da IA", [
          "Riscos do uso inadequado",
          "Fake news e desinformação",
          "Direitos autorais",
          "Uso ético nos estudos",
          "Boas práticas",
        ]),
      },
    ],
  },
  {
    order: 1,
    title: "Engenharia de Prompt",
    description: "Fundamentos, técnicas avançadas e criação de textos.",
    lessons: [
      {
        order: 0,
        title: "Fundamentos de Prompt",
        contentJson: richDoc("Fundamentos de Prompt", [
          "O que é prompt",
          "Estrutura clara de pedido",
          "Erros comuns",
          "Exercícios práticos",
        ]),
      },
      {
        order: 1,
        title: "Técnicas Avançadas de Prompt",
        contentJson: richDoc("Técnicas Avançadas de Prompt", [
          "Prompt contextual",
          "Prompt com exemplos",
          "Refinamento de respostas",
          "Comparação de resultados",
        ]),
      },
      {
        order: 2,
        title: "IA para Criação de Textos",
        contentJson: richDoc("IA para Criação de Textos", [
          "Criação de artigos",
          "Estruturação de textos",
          "Ajuste de tom e estilo",
          "Revisão e melhoria",
        ]),
      },
    ],
  },
  {
    order: 2,
    title: "IA para Criadores de Conteúdo",
    description: "Ideias, roteiros e estratégia de conteúdo.",
    lessons: [
      {
        order: 0,
        title: "Geração de Ideias para Redes Sociais",
        contentJson: richDoc("Geração de Ideias para Redes Sociais", [
          "Brainstorm com IA",
          "Calendário editorial",
          "Tendências",
          "Exercício prático",
        ]),
      },
      {
        order: 1,
        title: "Roteiros para Vídeos e Posts",
        contentJson: richDoc("Roteiros para Vídeos e Posts", [
          "Estrutura de roteiro",
          "Ganchos e chamadas",
          "Roteiros para Reels",
          "Produção prática",
        ]),
      },
      {
        order: 2,
        title: "IA para Estratégia de Conteúdo",
        contentJson: richDoc("IA para Estratégia de Conteúdo", [
          "Definição de público",
          "Persona",
          "Planejamento estratégico",
          "Organização de ideias",
        ]),
      },
    ],
  },
  {
    order: 3,
    title: "IA Aplicada aos Estudos",
    description: "Resumos, organização e pesquisa com IA.",
    lessons: [
      {
        order: 0,
        title: "IA para Resumos e Revisão",
        contentJson: richDoc("IA para Resumos e Revisão", [
          "Criação de resumos",
          "Explicações simplificadas",
          "Revisão para provas",
          "Exercício prático",
        ]),
      },
      {
        order: 1,
        title: "Organização de Estudos com IA",
        contentJson: richDoc("Organização de Estudos com IA", [
          "Planejamento semanal",
          "Organização de tarefas",
          "Cronogramas",
          "Técnicas de produtividade",
        ]),
      },
      {
        order: 2,
        title: "Pesquisa e Aprendizado Acelerado",
        contentJson: richDoc("Pesquisa e Aprendizado Acelerado", [
          "Uso da IA para pesquisa",
          "Estruturação de trabalhos",
          "Checagem de informações",
          "Limitações da IA",
        ]),
      },
    ],
  },
  {
    order: 4,
    title: "Produtividade e Automação",
    description: "Ferramentas e automação de tarefas.",
    lessons: [
      {
        order: 0,
        title: "Ferramentas de IA para Produtividade",
        contentJson: richDoc("Ferramentas de IA para Produtividade", [
          "Ferramentas complementares",
          "Organização pessoal",
          "Planejamento",
          "Demonstração prática",
        ]),
      },
      {
        order: 1,
        title: "Automação de Tarefas Simples",
        contentJson: richDoc("Automação de Tarefas Simples", [
          "Textos repetitivos",
          "Respostas automáticas",
          "Organização de conteúdo",
          "Simulação prática",
        ]),
      },
    ],
  },
  {
    order: 5,
    title: "Projeto Final",
    description: "Planejamento, execução e apresentação.",
    lessons: [
      {
        order: 0,
        title: "Planejamento do Projeto Final",
        contentJson: richDoc("Planejamento do Projeto Final", [
          "Escolha do projeto (redes sociais ou acadêmico)",
          "Estruturação do plano",
          "Definição de metas",
        ]),
      },
      {
        order: 1,
        title: "Apresentação e Aplicação Prática",
        contentJson: richDoc("Apresentação e Aplicação Prática", [
          "Execução do projeto",
          "Apresentação dos resultados",
          "Feedback coletivo",
          "Reflexão sobre uso responsável",
        ]),
      },
    ],
  },
];

export async function seedIACriadoresEstudantesModulesAndLessons(prisma: PrismaClient): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { slug: { equals: "ia-para-criadores-e-estudantes", mode: "insensitive" } },
        { name: { equals: "IA para Criadores e Estudantes", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!course) {
    throw new Error(
      'Curso "IA para Criadores e Estudantes" não encontrado. Crie o curso com slug "ia-para-criadores-e-estudantes" ou nome "IA para Criadores e Estudantes" (o seed principal já pode tê-lo criado).'
    );
  }

  const courseId = course.id;

  for (const mod of MODULES_AND_LESSONS) {
    let moduleRow = await prisma.courseModule.findFirst({
      where: { courseId, order: mod.order },
    });

    if (!moduleRow) {
      moduleRow = await prisma.courseModule.create({
        data: {
          courseId,
          title: mod.title,
          description: mod.description ?? null,
          order: mod.order,
        },
      });
    } else {
      await prisma.courseModule.update({
        where: { id: moduleRow.id },
        data: {
          title: mod.title,
          description: mod.description ?? null,
          order: mod.order,
        },
      });
    }

    for (const les of mod.lessons) {
      const existing = await prisma.courseLesson.findFirst({
        where: { moduleId: moduleRow.id, order: les.order },
      });

      if (!existing) {
        await prisma.courseLesson.create({
          data: {
            moduleId: moduleRow.id,
            title: les.title,
            order: les.order,
            durationMinutes: DURATION_MINUTES,
            contentRich: les.contentJson,
          },
        });
      } else {
        await prisma.courseLesson.update({
          where: { id: existing.id },
          data: {
            title: les.title,
            order: les.order,
            durationMinutes: DURATION_MINUTES,
            contentRich: les.contentJson,
          },
        });
      }
    }
  }

  console.log(`Curso "IA para Criadores e Estudantes": 6 módulos e 16 aulas criados/atualizados (20h).`);
}
