/**
 * Seed idempotente: módulos e aulas do curso "Manutenção de Computador" (6 módulos, 16 aulas, 20h).
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
    title: "Fundamentos do Hardware",
    description: "Introdução à manutenção e componentes internos.",
    lessons: [
      {
        order: 0,
        title: "Introdução à Manutenção de Computadores",
        contentJson: richDoc("Introdução à Manutenção de Computadores", [
          "O que faz um técnico de informática",
          "Principais problemas encontrados",
          "Segurança elétrica e estática",
          "Organização da bancada",
        ]),
      },
      {
        order: 1,
        title: "Componentes Internos do Computador (Parte 1)",
        contentJson: richDoc("Componentes Internos do Computador (Parte 1)", [
          "Placa-mãe",
          "Processador",
          "Memória RAM",
          "Compatibilidade de peças",
        ]),
      },
      {
        order: 2,
        title: "Componentes Internos do Computador (Parte 2)",
        contentJson: richDoc("Componentes Internos do Computador (Parte 2)", [
          "HD e SSD",
          "Fonte de alimentação",
          "Placa de vídeo",
          "Gabinete e ventilação",
        ]),
      },
    ],
  },
  {
    order: 1,
    title: "Montagem e Substituição de Peças",
    description: "Montagem de PC e troca de componentes.",
    lessons: [
      {
        order: 0,
        title: "Montagem de PC – Teoria",
        contentJson: richDoc("Montagem de PC – Teoria", [
          "Ordem correta de montagem",
          "Compatibilidade",
          "Instalação do processador",
        ]),
      },
      {
        order: 1,
        title: "Montagem de PC – Prática",
        contentJson: richDoc("Montagem de PC – Prática", [
          "Instalação de memória",
          "Instalação de HD/SSD",
          "Conexão da fonte",
          "Organização de cabos",
        ]),
      },
      {
        order: 2,
        title: "Troca de Peças",
        contentJson: richDoc("Troca de Peças", [
          "Substituição de HD por SSD",
          "Troca de memória RAM",
          "Troca de fonte",
          "Testes após substituição",
        ]),
      },
    ],
  },
  {
    order: 2,
    title: "Sistema Operacional e Programas",
    description: "Instalação de SO, formatação e programas essenciais.",
    lessons: [
      {
        order: 0,
        title: "Instalação de Sistema Operacional",
        contentJson: richDoc("Instalação de Sistema Operacional", [
          "O que é sistema operacional",
          "Criação de mídia",
          "Instalação passo a passo",
          "Configurações iniciais",
        ]),
      },
      {
        order: 1,
        title: "Formatação e Configuração",
        contentJson: richDoc("Formatação e Configuração", [
          "Backup básico",
          "Formatação do disco",
          "Particionamento simples",
          "Configuração pós-instalação",
        ]),
      },
      {
        order: 2,
        title: "Instalação de Programas Essenciais",
        contentJson: richDoc("Instalação de Programas Essenciais", [
          "Navegadores",
          "Pacote Office",
          "Atualizações do sistema",
        ]),
      },
    ],
  },
  {
    order: 3,
    title: "Diagnóstico e Manutenção",
    description: "Diagnóstico de falhas e manutenção preventiva.",
    lessons: [
      {
        order: 0,
        title: "Diagnóstico de Falhas",
        contentJson: richDoc("Diagnóstico de Falhas", [
          "Computador que não liga",
          "Tela preta",
          "Lentidão",
          "Problemas de energia",
        ]),
      },
      {
        order: 1,
        title: "Limpeza e Manutenção Preventiva",
        contentJson: richDoc("Limpeza e Manutenção Preventiva", [
          "Limpeza interna",
          "Pasta térmica (conceito)",
          "Prevenção de superaquecimento",
        ]),
      },
    ],
  },
  {
    order: 4,
    title: "Redes e Segurança",
    description: "Noções de rede, configurações e boas práticas.",
    lessons: [
      {
        order: 0,
        title: "Noções Básicas de Rede",
        contentJson: richDoc("Noções Básicas de Rede", [
          "Rede local",
          "Wi-Fi",
          "Roteador e modem",
          "Testes básicos",
        ]),
      },
      {
        order: 1,
        title: "Configurações Básicas de Rede",
        contentJson: richDoc("Configurações Básicas de Rede", [
          "Configuração simples",
          "Solução de problemas",
          "Compartilhamento de arquivos",
        ]),
      },
      {
        order: 2,
        title: "Segurança e Boas Práticas",
        contentJson: richDoc("Segurança e Boas Práticas", [
          "Antivírus",
          "Atualizações",
          "Backup",
          "Boas práticas",
        ]),
      },
    ],
  },
  {
    order: 5,
    title: "Profissionalização",
    description: "Atendimento ao cliente e projeto final.",
    lessons: [
      {
        order: 0,
        title: "Atendimento ao Cliente e Orçamento",
        contentJson: richDoc("Atendimento ao Cliente e Orçamento", [
          "Diagnóstico antes do orçamento",
          "Comunicação clara",
          "Garantia de serviço",
          "Ordem de serviço",
        ]),
      },
      {
        order: 1,
        title: "Projeto Final Prático",
        contentJson: richDoc("Projeto Final Prático", [
          "Diagnóstico completo",
          "Identificação do problema",
          "Proposta de solução",
          "Avaliação final",
        ]),
      },
    ],
  },
];

export async function seedManutencaoComputadorModulesAndLessons(prisma: PrismaClient): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { slug: { equals: "manutencao-de-computador", mode: "insensitive" } },
        { name: { equals: "Manutenção de Computador", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!course) {
    throw new Error(
      'Curso "Manutenção de Computador" não encontrado. Crie o curso com slug "manutencao-de-computador" ou nome "Manutenção de Computador" (o seed principal já pode tê-lo criado).'
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

  console.log(`Curso "Manutenção de Computador": 6 módulos e 16 aulas criados/atualizados (20h).`);
}
