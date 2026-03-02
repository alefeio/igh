/**
 * Seed idempotente: módulos e aulas do curso "Computação" (16 aulas, 20h).
 * Conteúdo em HTML (formato do RichTextEditor TipTap do projeto).
 */
import type { PrismaClient } from "../../src/generated/prisma/client";

const DURATION_MINUTES = 75; // 16 * 75 = 1200 min = 20h

type LessonSeed = {
  order: number;
  title: string;
  contentHtml: string;
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
    title: "Fundamentos de TI",
    description: "Introdução à tecnologia da informação e hardware.",
    lessons: [
      {
        order: 0,
        title: "Introdução à Tecnologia da Informação",
        contentHtml: `<p><strong>Objetivos da aula:</strong></p><ul><li>O que é TI; onde a tecnologia está presente</li><li>Hardware x software</li><li>Tipos de computadores</li><li>Dinâmica prática: identificar partes do computador</li></ul>`,
      },
      {
        order: 1,
        title: "Conhecendo o Hardware",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Processador, RAM, HD/SSD</li><li>Placa-mãe e fonte</li><li>Periféricos</li><li>Armazenamento x memória</li><li>Atividade prática: identificar peças</li></ul>`,
      },
      {
        order: 2,
        title: "Funcionamento do Computador",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Como o computador "pensa"</li><li>Entrada / processamento / saída</li><li>Binário (conceito simples)</li><li>Demonstração prática</li></ul>`,
      },
    ],
  },
  {
    order: 1,
    title: "Sistema Operacional e Organização",
    description: "Sistema operacional, arquivos e programas.",
    lessons: [
      {
        order: 0,
        title: "Sistema Operacional na Prática",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>O que é SO</li><li>Interface do Windows</li><li>Área de trabalho; Menu Iniciar</li><li>Prática de navegação</li></ul>`,
      },
      {
        order: 1,
        title: "Organização de Arquivos",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Criar pastas; nomear arquivos</li><li>Copiar / mover / excluir</li><li>Pendrive e armazenamento</li><li>Exercício prático</li></ul>`,
      },
      {
        order: 2,
        title: "Instalação de Programas",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>O que é software</li><li>Instalar e desinstalar</li><li>Cuidados com downloads</li><li>Antivírus e segurança básica</li></ul>`,
      },
    ],
  },
  {
    order: 2,
    title: "Redes e Internet",
    description: "Fundamentos de redes e navegação segura.",
    lessons: [
      {
        order: 0,
        title: "Fundamentos de Redes",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>O que é rede</li><li>Rede local e internet</li><li>Wi-Fi e cabo</li><li>Roteador e modem</li></ul>`,
      },
      {
        order: 1,
        title: "Navegação Segura na Internet",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Navegador; e-mail</li><li>Pesquisa no Google</li><li>Segurança digital</li><li>Golpes comuns</li></ul>`,
      },
    ],
  },
  {
    order: 3,
    title: "Informática Aplicada (Word)",
    description: "Editor de texto: primeiros passos e documento profissional.",
    lessons: [
      {
        order: 0,
        title: "Word: Primeiros Passos",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Interface</li><li>Digitação; formatação básica; fonte</li><li>Salvar arquivos</li></ul>`,
      },
      {
        order: 1,
        title: "Word: Documento Profissional",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Alinhamento; listas</li><li>Inserir imagens</li><li>Criar documento; exercício prático</li></ul>`,
      },
    ],
  },
  {
    order: 4,
    title: "Informática Aplicada (Excel)",
    description: "Planilha: introdução e organização.",
    lessons: [
      {
        order: 0,
        title: "Excel: Introdução",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Interface</li><li>Células e planilhas</li><li>Inserir dados</li><li>Fórmulas simples (soma)</li></ul>`,
      },
      {
        order: 1,
        title: "Excel: Organização e Cálculo",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Formatação; fórmulas básicas</li><li>Tabela</li><li>Exercício prático (controle simples)</li></ul>`,
      },
    ],
  },
  {
    order: 5,
    title: "Informática Aplicada (PowerPoint)",
    description: "Apresentações: introdução e design.",
    lessons: [
      {
        order: 0,
        title: "PowerPoint: Introdução",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Interface</li><li>Criar slides</li><li>Inserir texto e imagens</li></ul>`,
      },
      {
        order: 1,
        title: "PowerPoint: Apresentação Profissional",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Design simples</li><li>Transições; organização</li><li>Mini apresentaçao</li></ul>`,
      },
    ],
  },
  {
    order: 6,
    title: "Consolidação e Projeto Final",
    description: "Revisão e projeto integrador.",
    lessons: [
      {
        order: 0,
        title: "Revisão Geral e Integração",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Revisão hardware / software / redes</li><li>Revisão Word / Excel / PowerPoint</li><li>Dúvidas</li><li>Orientação do projeto final</li></ul>`,
      },
      {
        order: 1,
        title: "Projeto Final",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Produção (Word + Excel + PowerPoint)</li><li>Apresentação</li><li>Feedback final</li></ul>`,
      },
    ],
  },
];

export async function seedComputacaoModulesAndLessons(prisma: PrismaClient): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { slug: { equals: "computacao", mode: "insensitive" } },
        { name: { contains: "Computação", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!course) {
    throw new Error(
      'Curso "Computação" não encontrado no banco. Execute o seed principal primeiro ou crie o curso com slug "computacao" ou nome contendo "Computação".'
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
            contentRich: les.contentHtml,
          },
        });
      } else {
        await prisma.courseLesson.update({
          where: { id: existing.id },
          data: {
            title: les.title,
            order: les.order,
            durationMinutes: DURATION_MINUTES,
            contentRich: les.contentHtml,
          },
        });
      }
    }
  }

  console.log(`Curso "Computação": 7 módulos e 16 aulas criados/atualizados.`);
}
