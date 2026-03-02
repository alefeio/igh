/**
 * Seed idempotente: módulos e aulas do curso "Programador Web (Frontend e Backend)" (6 módulos, 16 aulas, 20h).
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
    title: "Fundamentos e Lógica",
    description: "Introdução à programação e lógica de programação.",
    lessons: [
      {
        order: 0,
        title: "Introdução à Programação e à Web",
        contentJson: richDoc("Introdução à Programação e à Web", [
          "O que é programação",
          "O que é desenvolvimento web",
          "Frontend x Backend",
          "Como funciona um site",
          "Estrutura básica da internet",
        ]),
      },
      {
        order: 1,
        title: "Lógica de Programação (Parte 1)",
        contentJson: richDoc("Lógica de Programação (Parte 1)", [
          "O que é algoritmo",
          "Variáveis",
          "Tipos de dados",
          "Operadores básicos",
        ]),
      },
      {
        order: 2,
        title: "Lógica de Programação (Parte 2)",
        contentJson: richDoc("Lógica de Programação (Parte 2)", [
          "Condicionais (if/else)",
          "Estruturas de repetição (loops)",
          "Funções (conceito básico)",
          "Exercícios práticos",
        ]),
      },
    ],
  },
  {
    order: 1,
    title: "HTML (Estrutura da Web)",
    description: "Estrutura da web e HTML.",
    lessons: [
      {
        order: 0,
        title: "Estrutura da Web e HTML Básico",
        contentJson: richDoc("Estrutura da Web e HTML Básico", [
          "O que é HTML",
          "Estrutura básica de uma página",
          "Tags principais",
          "Criar primeira página",
        ]),
      },
      {
        order: 1,
        title: "HTML Intermediário",
        contentJson: richDoc("HTML Intermediário", [
          "Títulos, parágrafos e listas",
          "Links",
          "Imagens",
          "Estrutura semântica básica",
        ]),
      },
      {
        order: 2,
        title: "Formulários em HTML",
        contentJson: richDoc("Formulários em HTML", [
          "Inputs",
          "Botões",
          "Campos de texto",
          "Estrutura de formulário simples",
        ]),
      },
    ],
  },
  {
    order: 2,
    title: "CSS (Estilização)",
    description: "Introdução ao CSS, layout e página completa.",
    lessons: [
      {
        order: 0,
        title: "Introdução ao CSS",
        contentJson: richDoc("Introdução ao CSS", [
          "O que é CSS",
          "Seletores",
          "Cores",
          "Fontes",
        ]),
      },
      {
        order: 1,
        title: "Layout e Organização",
        contentJson: richDoc("Layout e Organização", [
          "Box model",
          "Margin e padding",
          "Display",
          "Noções básicas de responsividade",
        ]),
      },
      {
        order: 2,
        title: "Construindo um Layout Completo",
        contentJson: richDoc("Construindo um Layout Completo", [
          "Estrutura de página",
          "Cabeçalho, conteúdo e rodapé",
          "Estilização completa",
        ]),
      },
    ],
  },
  {
    order: 3,
    title: "JavaScript (Interatividade)",
    description: "Introdução ao JavaScript e manipulação do DOM.",
    lessons: [
      {
        order: 0,
        title: "Introdução ao JavaScript",
        contentJson: richDoc("Introdução ao JavaScript", [
          "Variáveis",
          "Funções",
          "Conceitos básicos",
        ]),
      },
      {
        order: 1,
        title: "Interatividade na Página",
        contentJson: richDoc("Interatividade na Página", [
          "Eventos (click)",
          "Manipulação do DOM",
          "Alteração dinâmica de conteúdo",
        ]),
      },
    ],
  },
  {
    order: 4,
    title: "Backend e Banco de Dados",
    description: "Backend, banco de dados e integração.",
    lessons: [
      {
        order: 0,
        title: "Introdução ao Backend",
        contentJson: richDoc("Introdução ao Backend", [
          "O que é backend",
          "Conceito de servidor",
          "Conceito de API",
          "Fluxo cliente-servidor",
        ]),
      },
      {
        order: 1,
        title: "Noções de Banco de Dados",
        contentJson: richDoc("Noções de Banco de Dados", [
          "O que é banco de dados",
          "Tabelas e registros",
          "Conceito de CRUD",
        ]),
      },
      {
        order: 2,
        title: "Integração Frontend e Backend",
        contentJson: richDoc("Integração Frontend e Backend", [
          "Requisição e resposta",
          "Envio de dados de formulário",
          "Fluxo completo da aplicação",
        ]),
      },
    ],
  },
  {
    order: 5,
    title: "Projeto Final",
    description: "Planejamento, desenvolvimento e apresentação.",
    lessons: [
      {
        order: 0,
        title: "Planejamento do Projeto Web",
        contentJson: richDoc("Planejamento do Projeto Web", [
          "Definição do tema",
          "Estrutura do projeto",
          "Organização frontend/backend",
        ]),
      },
      {
        order: 1,
        title: "Desenvolvimento e Apresentação Final",
        contentJson: richDoc("Desenvolvimento e Apresentação Final", [
          "Finalização do projeto",
          "Testes",
          "Apresentação da aplicação",
          "Feedback final",
        ]),
      },
    ],
  },
];

export async function seedProgramadorWebModulesAndLessons(prisma: PrismaClient): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { slug: { equals: "programador-web-frontend-e-backend", mode: "insensitive" } },
        { name: { equals: "Programador Web (Frontend e Backend)", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!course) {
    throw new Error(
      'Curso "Programador Web (Frontend e Backend)" não encontrado. Crie o curso com slug "programador-web-frontend-e-backend" ou nome "Programador Web (Frontend e Backend)" (o seed principal já pode tê-lo criado).'
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

  console.log(`Curso "Programador Web (Frontend e Backend)": 6 módulos e 16 aulas criados/atualizados (20h).`);
}
