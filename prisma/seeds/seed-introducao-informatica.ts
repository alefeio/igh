/**
 * Seed idempotente: módulos e aulas do curso "Introdução à Informática" (6 módulos, 16 aulas, 20h).
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
    title: "Primeiros Passos com o Computador",
    description: "Computador, mouse e teclado.",
    lessons: [
      {
        order: 0,
        title: "Conhecendo o Computador",
        contentJson: richDoc("Conhecendo o Computador", [
          "O que é computador",
          "Monitor, CPU, teclado e mouse",
          "Ligar e desligar corretamente",
          "Cuidados básicos",
        ]),
      },
      {
        order: 1,
        title: "Usando o Mouse",
        contentJson: richDoc("Usando o Mouse", [
          "Clique simples",
          "Clique duplo",
          "Clique direito",
          "Arrastar",
          "Exercícios práticos",
        ]),
      },
      {
        order: 2,
        title: "Usando o Teclado",
        contentJson: richDoc("Usando o Teclado", [
          "Letras, números e símbolos",
          "Teclas importantes (Enter, Backspace, Shift, Ctrl)",
          "Exercícios de digitação",
        ]),
      },
    ],
  },
  {
    order: 1,
    title: "Sistema Operacional e Organização",
    description: "Sistema operacional, pastas e arquivos.",
    lessons: [
      {
        order: 0,
        title: "Conhecendo o Sistema Operacional",
        contentJson: richDoc("Conhecendo o Sistema Operacional", [
          "O que é sistema operacional",
          "Área de trabalho",
          "Menu iniciar",
          "Abrir e fechar programas",
        ]),
      },
      {
        order: 1,
        title: "Criando e Organizando Pastas",
        contentJson: richDoc("Criando e Organizando Pastas", [
          "Criar pasta",
          "Renomear",
          "Excluir",
          "Mover arquivos",
        ]),
      },
      {
        order: 2,
        title: "Criar, Salvar e Localizar Arquivos",
        contentJson: richDoc("Criar, Salvar e Localizar Arquivos", [
          "Salvar corretamente",
          "Salvar como",
          "Localizar arquivos",
          "Buscar no computador",
        ]),
      },
    ],
  },
  {
    order: 2,
    title: "Internet e Comunicação",
    description: "Internet, navegação segura e e-mail.",
    lessons: [
      {
        order: 0,
        title: "Noções de Internet",
        contentJson: richDoc("Noções de Internet", [
          "O que é internet",
          "O que é navegador",
          "Pesquisa no Google",
        ]),
      },
      {
        order: 1,
        title: "Navegação Segura",
        contentJson: richDoc("Navegação Segura", [
          "Sites seguros",
          "Golpes comuns",
          "Links suspeitos",
          "Cuidados ao baixar arquivos",
        ]),
      },
      {
        order: 2,
        title: "Criando um E-mail",
        contentJson: richDoc("Criando um E-mail", [
          "O que é e-mail",
          "Criar conta",
          "Senha segura",
        ]),
      },
      {
        order: 3,
        title: "Enviando e Recebendo E-mails",
        contentJson: richDoc("Enviando e Recebendo E-mails", [
          "Escrever mensagem",
          "Anexar arquivo",
          "Responder e encaminhar",
        ]),
      },
    ],
  },
  {
    order: 3,
    title: "Introdução ao Word",
    description: "Editor de texto: primeiros passos e documento formatado.",
    lessons: [
      {
        order: 0,
        title: "Conhecendo o Word",
        contentJson: richDoc("Conhecendo o Word", [
          "Abrir o Word",
          "Digitar texto",
          "Formatação básica",
          "Salvar documento",
        ]),
      },
      {
        order: 1,
        title: "Criando um Documento Simples",
        contentJson: richDoc("Criando um Documento Simples", [
          "Alinhamento",
          "Listas",
          "Inserir imagem",
          "Criar documento formatado",
        ]),
      },
    ],
  },
  {
    order: 4,
    title: "Introdução ao Excel",
    description: "Planilha: conceitos e prática básica.",
    lessons: [
      {
        order: 0,
        title: "Conhecendo o Excel",
        contentJson: richDoc("Conhecendo o Excel", [
          "O que é planilha",
          "Células e colunas",
          "Inserir dados",
        ]),
      },
      {
        order: 1,
        title: "Excel Básico na Prática",
        contentJson: richDoc("Excel Básico na Prática", [
          "Fórmula simples (soma)",
          "Organização de tabela",
          "Formatação básica",
        ]),
      },
    ],
  },
  {
    order: 5,
    title: "PowerPoint e Segurança Digital",
    description: "Apresentações e revisão de segurança.",
    lessons: [
      {
        order: 0,
        title: "Criando Apresentações no PowerPoint",
        contentJson: richDoc("Criando Apresentações no PowerPoint", [
          "Criar slides",
          "Inserir texto",
          "Inserir imagens",
          "Alterar tema",
        ]),
      },
      {
        order: 1,
        title: "Segurança Digital e Revisão Geral",
        contentJson: richDoc("Segurança Digital e Revisão Geral", [
          "Senhas seguras",
          "Cuidados nas redes sociais",
          "Revisão geral do curso",
        ]),
      },
    ],
  },
];

export async function seedIntroducaoInformaticaModulesAndLessons(prisma: PrismaClient): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { slug: { equals: "introducao-a-informatica", mode: "insensitive" } },
        { name: { equals: "Introdução à Informática", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!course) {
    throw new Error(
      'Curso "Introdução à Informática" não encontrado. Crie o curso com slug "introducao-a-informatica" ou nome "Introdução à Informática" (o seed principal já pode tê-lo criado).'
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

  console.log(`Curso "Introdução à Informática": 6 módulos e 16 aulas criados/atualizados (20h).`);
}
