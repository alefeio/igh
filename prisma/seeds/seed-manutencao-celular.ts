/**
 * Seed idempotente: módulos e aulas do curso "Manutenção de Celular" (6 módulos, 16 aulas, 32h).
 * Conteúdo em JSON (formato TipTap/ProseMirror do RichTextEditor do projeto).
 */
import type { PrismaClient } from "../../src/generated/prisma/client";

const DURATION_MINUTES = 120; // 16 × 120 = 1920 min = 32h

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
    title: "Fundamentos da Manutenção",
    description: "Mercado, estrutura interna e identificação de peças.",
    lessons: [
      {
        order: 0,
        title: "Introdução à Manutenção de Celulares",
        contentJson: richDoc("Introdução à Manutenção de Celulares", [
          "Mercado de manutenção",
          "Perfil profissional",
          "Tipos de defeitos comuns",
          "Segurança e organização da bancada",
        ]),
      },
      {
        order: 1,
        title: "Estrutura Interna dos Smartphones",
        contentJson: richDoc("Estrutura Interna dos Smartphones", [
          "Placa-mãe",
          "Tela",
          "Bateria",
          "Conectores e cabos flat",
          "Alto-falante e microfone",
        ]),
      },
      {
        order: 2,
        title: "Identificação de Peças e Componentes",
        contentJson: richDoc("Identificação de Peças e Componentes", [
          "Reconhecimento visual",
          "Peças originais x paralelas",
          "Componentes mais substituídos",
        ]),
      },
    ],
  },
  {
    order: 1,
    title: "Ferramentas e Procedimentos",
    description: "Ferramentas, desmontagem e manutenção preventiva.",
    lessons: [
      {
        order: 0,
        title: "Ferramentas para Manutenção",
        contentJson: richDoc("Ferramentas para Manutenção", [
          "Chaves específicas",
          "Espátulas e pinças",
          "Estação de ar quente (conceito)",
          "Multímetro (conceito básico)",
          "Cuidados no uso",
        ]),
      },
      {
        order: 1,
        title: "Desmontagem Segura",
        contentJson: richDoc("Desmontagem Segura", [
          "Passo a passo da desmontagem",
          "Cuidados com cabos flat",
          "Organização de parafusos",
        ]),
      },
      {
        order: 2,
        title: "Limpeza e Manutenção Preventiva",
        contentJson: richDoc("Limpeza e Manutenção Preventiva", [
          "Limpeza interna",
          "Oxidação",
          "Manutenção preventiva",
        ]),
      },
    ],
  },
  {
    order: 2,
    title: "Troca de Componentes",
    description: "Troca de tela e de bateria.",
    lessons: [
      {
        order: 0,
        title: "Troca de Tela – Teoria e Preparação",
        contentJson: richDoc("Troca de Tela – Teoria e Preparação", [
          "Tipos de tela",
          "Aquecimento e separação",
          "Preparação para troca",
        ]),
      },
      {
        order: 1,
        title: "Troca de Tela – Prática",
        contentJson: richDoc("Troca de Tela – Prática", [
          "Remoção da tela danificada",
          "Instalação da nova tela",
          "Testes antes do fechamento",
        ]),
      },
      {
        order: 2,
        title: "Troca de Bateria",
        contentJson: richDoc("Troca de Bateria", [
          "Identificação de bateria defeituosa",
          "Remoção segura",
          "Instalação correta",
          "Testes",
        ]),
      },
    ],
  },
  {
    order: 3,
    title: "Diagnóstico de Defeitos",
    description: "Problemas comuns e testes de componentes.",
    lessons: [
      {
        order: 0,
        title: "Diagnóstico de Problemas Comuns",
        contentJson: richDoc("Diagnóstico de Problemas Comuns", [
          "Celular que não liga",
          "Tela preta",
          "Falha no carregamento",
          "Problemas de áudio",
        ]),
      },
      {
        order: 1,
        title: "Testes e Verificação de Componentes",
        contentJson: richDoc("Testes e Verificação de Componentes", [
          "Testes básicos",
          "Fluxo lógico de diagnóstico",
          "Simulação prática",
        ]),
      },
    ],
  },
  {
    order: 4,
    title: "Software e Configurações",
    description: "Noções de software, reset e backup.",
    lessons: [
      {
        order: 0,
        title: "Noções Básicas de Software",
        contentJson: richDoc("Noções Básicas de Software", [
          "Sistema Android (conceito)",
          "Atualizações",
          "Problemas de software",
        ]),
      },
      {
        order: 1,
        title: "Reset e Configurações",
        contentJson: richDoc("Reset e Configurações", [
          "Reset simples",
          "Reset de fábrica",
          "Backup básico",
          "Cuidados antes do reset",
        ]),
      },
    ],
  },
  {
    order: 5,
    title: "Profissionalização",
    description: "Atendimento, gestão e projeto final.",
    lessons: [
      {
        order: 0,
        title: "Atendimento ao Cliente",
        contentJson: richDoc("Atendimento ao Cliente", [
          "Comunicação clara",
          "Orçamento",
          "Garantia",
          "Simulação de atendimento",
        ]),
      },
      {
        order: 1,
        title: "Gestão Básica de Assistência Técnica",
        contentJson: richDoc("Gestão Básica de Assistência Técnica", [
          "Ordem de serviço",
          "Controle de peças",
          "Precificação básica",
          "Noções de lucro",
        ]),
      },
      {
        order: 2,
        title: "Projeto Final Prático",
        contentJson: richDoc("Projeto Final Prático", [
          "Diagnóstico completo",
          "Identificação do defeito",
          "Execução do reparo",
          "Avaliação final",
        ]),
      },
    ],
  },
];

export async function seedManutencaoCelularModulesAndLessons(prisma: PrismaClient): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { slug: { equals: "manutencao-de-celular", mode: "insensitive" } },
        { name: { equals: "Manutenção de Celular", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!course) {
    throw new Error(
      'Curso "Manutenção de Celular" não encontrado. Crie o curso com slug "manutencao-de-celular" ou nome "Manutenção de Celular" (o seed principal já pode tê-lo criado).'
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

  console.log(`Curso "Manutenção de Celular": 6 módulos e 16 aulas criados/atualizados (32h).`);
}
