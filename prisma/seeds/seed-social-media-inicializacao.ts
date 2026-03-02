/**
 * Seed idempotente: módulos e aulas do curso "Social Media - Inicialização" (6 módulos, 16 aulas, 20h).
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
    description: "Marketing digital, papel do social media e posicionamento.",
    lessons: [
      {
        order: 0,
        title: "Introdução ao Marketing Digital",
        contentJson: richDoc("Introdução ao Marketing Digital", [
          "O que é marketing digital",
          "Diferença entre marketing tradicional e digital",
          "O papel das redes sociais",
          "Funil de conteúdo",
        ]),
      },
      {
        order: 1,
        title: "O Papel do Social Media",
        contentJson: richDoc("O Papel do Social Media", [
          "Responsabilidades do social media",
          "Mercado de trabalho",
          "Áreas de atuação",
        ]),
      },
      {
        order: 2,
        title: "Posicionamento Profissional",
        contentJson: richDoc("Posicionamento Profissional", [
          "Marca pessoal",
          "Nicho de atuação",
          "Construção de perfil profissional",
        ]),
      },
    ],
  },
  {
    order: 1,
    title: "Planejamento Estratégico",
    description: "Planejamento de conteúdo, calendário editorial e estratégia.",
    lessons: [
      {
        order: 0,
        title: "Planejamento de Conteúdo",
        contentJson: richDoc("Planejamento de Conteúdo", [
          "Definição de objetivos",
          "Público-alvo",
          "Persona",
          "Tipos de conteúdo",
        ]),
      },
      {
        order: 1,
        title: "Calendário Editorial",
        contentJson: richDoc("Calendário Editorial", [
          "Organização semanal",
          "Frequência de postagem",
          "Distribuição de temas",
        ]),
      },
      {
        order: 2,
        title: "Estratégia de Conteúdo",
        contentJson: richDoc("Estratégia de Conteúdo", [
          "Conteúdo de valor",
          "Conteúdo de autoridade",
          "Conteúdo de venda",
        ]),
      },
    ],
  },
  {
    order: 2,
    title: "Produção de Conteúdo",
    description: "Posts estratégicos, engajamento e identidade visual.",
    lessons: [
      {
        order: 0,
        title: "Produção de Posts Estratégicos",
        contentJson: richDoc("Produção de Posts Estratégicos", [
          "Estrutura de post eficaz",
          "Títulos e chamadas",
          "Clareza na mensagem",
        ]),
      },
      {
        order: 1,
        title: "Técnicas de Engajamento",
        contentJson: richDoc("Técnicas de Engajamento", [
          "CTA",
          "Perguntas estratégicas",
          "Interação nos comentários",
        ]),
      },
      {
        order: 2,
        title: "Noções de Identidade Visual",
        contentJson: richDoc("Noções de Identidade Visual", [
          "Cores",
          "Tipografia",
          "Padronização visual",
          "Coerência no feed",
        ]),
      },
    ],
  },
  {
    order: 3,
    title: "Crescimento Orgânico",
    description: "Estratégias de crescimento e algoritmo.",
    lessons: [
      {
        order: 0,
        title: "Estratégias de Crescimento Orgânico",
        contentJson: richDoc("Estratégias de Crescimento Orgânico", [
          "Hashtags",
          "Parcerias",
          "Consistência",
        ]),
      },
      {
        order: 1,
        title: "Algoritmo e Alcance",
        contentJson: richDoc("Algoritmo e Alcance", [
          "Funcionamento básico do algoritmo",
          "Fatores que influenciam alcance",
          "Estratégias práticas",
        ]),
      },
    ],
  },
  {
    order: 4,
    title: "Métricas e Análise",
    description: "Métricas, análise de resultados e otimização de perfil.",
    lessons: [
      {
        order: 0,
        title: "Métricas Básicas",
        contentJson: richDoc("Métricas Básicas", [
          "Alcance",
          "Engajamento",
          "Impressões",
          "Seguidores",
        ]),
      },
      {
        order: 1,
        title: "Análise de Resultados",
        contentJson: richDoc("Análise de Resultados", [
          "Identificar o que funciona",
          "Ajustar estratégia",
          "Avaliar crescimento",
        ]),
      },
      {
        order: 2,
        title: "Otimização de Perfil",
        contentJson: richDoc("Otimização de Perfil", [
          "Bio estratégica",
          "Link na bio",
          "Destaques",
          "Ajustes visuais",
        ]),
      },
    ],
  },
  {
    order: 5,
    title: "Projeto Final",
    description: "Planejamento e apresentação do projeto.",
    lessons: [
      {
        order: 0,
        title: "Planejamento do Projeto Final",
        contentJson: richDoc("Planejamento do Projeto Final", [
          "Escolha de nicho",
          "Criação de estratégia",
          "Planejamento de 1 semana de conteúdo",
        ]),
      },
      {
        order: 1,
        title: "Apresentação do Projeto",
        contentJson: richDoc("Apresentação do Projeto", [
          "Apresentação da estratégia",
          "Feedback coletivo",
          "Orientação para próximos passos",
        ]),
      },
    ],
  },
];

export async function seedSocialMediaInicializacaoModulesAndLessons(prisma: PrismaClient): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { slug: { equals: "social-media-inicializacao", mode: "insensitive" } },
        { name: { equals: "Social Media - Inicialização", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!course) {
    throw new Error(
      'Curso "Social Media - Inicialização" não encontrado. Crie o curso com slug "social-media-inicializacao" ou nome "Social Media - Inicialização" (o seed principal já pode tê-lo criado).'
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

  console.log(`Curso "Social Media - Inicialização": 6 módulos e 16 aulas criados/atualizados (20h).`);
}
