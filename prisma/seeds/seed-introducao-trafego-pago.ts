/**
 * Seed idempotente: módulos e aulas do curso "Introdução ao Tráfego Pago" (6 módulos, 16 aulas, 20h).
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
    title: "Fundamentos do Marketing Digital",
    description: "Marketing digital, tráfego pago e plataformas de anúncios.",
    lessons: [
      {
        order: 0,
        title: "Introdução ao Marketing Digital",
        contentJson: richDoc("Introdução ao Marketing Digital", [
          "O que é marketing digital",
          "Diferença entre marketing tradicional e digital",
          "Jornada do cliente",
          "Funil de vendas",
          "Exemplos reais",
        ]),
      },
      {
        order: 1,
        title: "Conceito de Tráfego Pago",
        contentJson: richDoc("Conceito de Tráfego Pago", [
          "O que é tráfego",
          "Tráfego orgânico vs pago",
          "Por que investir em anúncios",
          "Exemplos práticos",
        ]),
      },
      {
        order: 2,
        title: "Plataformas de Anúncios",
        contentJson: richDoc("Plataformas de Anúncios", [
          "Meta Ads",
          "Google Ads",
          "Diferenças entre plataformas",
          "Onde o público está",
        ]),
      },
    ],
  },
  {
    order: 1,
    title: "Estrutura de Campanhas",
    description: "Estrutura de campanha, segmentação e objetivos.",
    lessons: [
      {
        order: 0,
        title: "Estrutura de Campanha Online",
        contentJson: richDoc("Estrutura de Campanha Online", [
          "Campanha",
          "Conjunto de anúncios",
          "Anúncio",
          "Objetivos de campanha",
        ]),
      },
      {
        order: 1,
        title: "Segmentação de Público",
        contentJson: richDoc("Segmentação de Público", [
          "Público frio, morno e quente",
          "Interesses",
          "Comportamentos",
          "Públicos personalizados",
        ]),
      },
      {
        order: 2,
        title: "Definindo Objetivos de Campanha",
        contentJson: richDoc("Definindo Objetivos de Campanha", [
          "Reconhecimento",
          "Engajamento",
          "Conversão",
          "Simulação prática",
        ]),
      },
    ],
  },
  {
    order: 2,
    title: "Criação de Anúncios",
    description: "Criativos, copywriting e Meta Ads.",
    lessons: [
      {
        order: 0,
        title: "Criação de Criativos (Imagem)",
        contentJson: richDoc("Criação de Criativos (Imagem)", [
          "Elementos visuais que convertem",
          "Erros comuns",
          "Exemplos de bons anúncios",
        ]),
      },
      {
        order: 1,
        title: "Copywriting para Anúncios",
        contentJson: richDoc("Copywriting para Anúncios", [
          "Estrutura de texto persuasivo",
          "Ganchos",
          "Chamadas para ação",
          "Produção prática",
        ]),
      },
      {
        order: 2,
        title: "Introdução ao Meta Ads",
        contentJson: richDoc("Introdução ao Meta Ads", [
          "Interface básica",
          "Criar conta (simulação)",
          "Configurações iniciais",
        ]),
      },
    ],
  },
  {
    order: 3,
    title: "Estratégia e Conversão",
    description: "Conversão, oferta e orçamento.",
    lessons: [
      {
        order: 0,
        title: "Estratégias para Conversão",
        contentJson: richDoc("Estratégias para Conversão", [
          "O que é conversão",
          "Oferta",
          "Prova social",
          "Estrutura básica de landing page",
        ]),
      },
      {
        order: 1,
        title: "Orçamento e Investimento",
        contentJson: richDoc("Orçamento e Investimento", [
          "Definição de orçamento",
          "CPC",
          "Testes A/B",
          "Distribuição de verba",
        ]),
      },
    ],
  },
  {
    order: 4,
    title: "Métricas e Análise",
    description: "Métricas, análise de resultados e otimização.",
    lessons: [
      {
        order: 0,
        title: "Métricas Principais",
        contentJson: richDoc("Métricas Principais", [
          "Alcance",
          "Impressões",
          "CPC",
          "CTR",
          "Conversão",
        ]),
      },
      {
        order: 1,
        title: "Análise de Resultados",
        contentJson: richDoc("Análise de Resultados", [
          "Identificar campanha boa ou ruim",
          "Diagnóstico de problemas",
          "Exercício com dados simulados",
        ]),
      },
      {
        order: 2,
        title: "Otimização de Campanhas",
        contentJson: richDoc("Otimização de Campanhas", [
          "Ajuste de público",
          "Ajuste de criativo",
          "Ajuste de orçamento",
          "Escala de campanhas",
        ]),
      },
    ],
  },
  {
    order: 5,
    title: "Projeto Final",
    description: "Planejamento e apresentação da campanha.",
    lessons: [
      {
        order: 0,
        title: "Planejamento da Campanha Final",
        contentJson: richDoc("Planejamento da Campanha Final", [
          "Escolha de produto ou serviço",
          "Definição do público",
          "Criação de anúncio completo",
          "Definição de orçamento",
        ]),
      },
      {
        order: 1,
        title: "Apresentação da Campanha",
        contentJson: richDoc("Apresentação da Campanha", [
          "Apresentação da estratégia",
          "Análise coletiva",
          "Feedback final",
        ]),
      },
    ],
  },
];

export async function seedIntroducaoTrafegoPagoModulesAndLessons(prisma: PrismaClient): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { slug: { equals: "introducao-ao-trafego-pago", mode: "insensitive" } },
        { name: { equals: "Introdução ao Tráfego Pago", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!course) {
    throw new Error(
      'Curso "Introdução ao Tráfego Pago" não encontrado. Crie o curso com slug "introducao-ao-trafego-pago" ou nome "Introdução ao Tráfego Pago" (o seed principal já pode tê-lo criado).'
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

  console.log(`Curso "Introdução ao Tráfego Pago": 6 módulos e 16 aulas criados/atualizados (20h).`);
}
