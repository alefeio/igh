/**
 * Seed idempotente: módulos e aulas do curso "Fotografia Mobile" (5 módulos, 16 aulas, 20h).
 * Conteúdo em HTML (formato do RichTextEditor TipTap do projeto).
 */
import type { PrismaClient } from "../../src/generated/prisma/client";

const DURATION_MINUTES = 75; // 16 × 75 = 1200 min = 20h

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
    title: "Fundamentos da Fotografia",
    description: "Luz, composição, planos e ângulos.",
    lessons: [
      {
        order: 0,
        title: "Introdução à Fotografia Mobile",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>O que é fotografia</li><li>Importância da imagem na era digital</li><li>Fotografia profissional vs amadora</li><li>O celular como ferramenta profissional</li><li>Análise prática de imagens</li></ul>`,
      },
      {
        order: 1,
        title: "Fundamentos da Luz",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Luz natural vs artificial</li><li>Direção da luz (frontal, lateral, contra-luz)</li><li>Intensidade e sombra</li><li>Exercício prático com diferentes fontes de luz</li></ul>`,
      },
      {
        order: 2,
        title: "Composição e Enquadramento",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Regra dos terços</li><li>Simetria</li><li>Linhas e profundidade</li><li>Espaço negativo</li><li>Exercício prático</li></ul>`,
      },
      {
        order: 3,
        title: "Planos e Ângulos",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Plano aberto, médio e fechado</li><li>Ângulo normal, plongée e contra-plongée</li><li>Perspectiva criativa</li><li>Prática orientada</li></ul>`,
      },
    ],
  },
  {
    order: 1,
    title: "Domínio da Câmera do Celular",
    description: "Configurações, fotos de produto, retratos e fotografia criativa.",
    lessons: [
      {
        order: 0,
        title: "Configurações da Câmera",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Foco automático e manual</li><li>HDR</li><li>Resolução</li><li>Modo retrato</li><li>Ajustes básicos</li></ul>`,
      },
      {
        order: 1,
        title: "Técnicas para Fotos de Produto",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Iluminação para produtos</li><li>Fundo neutro</li><li>Composição comercial</li><li>Simulação de foto para venda</li></ul>`,
      },
      {
        order: 2,
        title: "Técnicas para Retratos",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Direção de modelo</li><li>Expressão e naturalidade</li><li>Uso do modo retrato</li><li>Controle de fundo</li></ul>`,
      },
      {
        order: 3,
        title: "Fotografia Criativa",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Sombras</li><li>Silhuetas</li><li>Reflexos</li><li>Texturas</li><li>Exercício criativo</li></ul>`,
      },
    ],
  },
  {
    order: 2,
    title: "Fotografia para Redes Sociais",
    description: "Conteúdo visual para redes e identidade visual.",
    lessons: [
      {
        order: 0,
        title: "Introdução à Fotografia para Redes",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Importância da imagem nas redes</li><li>Tipos de conteúdo visual</li><li>Fotografia para Instagram</li><li>Identidade visual</li></ul>`,
      },
      {
        order: 1,
        title: "Produção de Conteúdo Visual",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Planejamento de fotos</li><li>Sequência visual para feed</li><li>Coerência de cores</li><li>Mini projeto simulado</li></ul>`,
      },
    ],
  },
  {
    order: 3,
    title: "Edição no Celular",
    description: "Introdução à edição, cor, contraste, nitidez e finalização.",
    lessons: [
      {
        order: 0,
        title: "Introdução à Edição",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Por que editar</li><li>Aplicativos de edição</li><li>Interface básica</li><li>Ajustes simples</li></ul>`,
      },
      {
        order: 1,
        title: "Ajustes de Cor e Contraste",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Brilho</li><li>Contraste</li><li>Saturação</li><li>Temperatura</li><li>Antes/depois</li></ul>`,
      },
      {
        order: 2,
        title: "Nitidez, Filtros e Finalização",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Nitidez</li><li>Filtros equilibrados</li><li>Evitar exageros</li><li>Padronização visual</li></ul>`,
      },
    ],
  },
  {
    order: 4,
    title: "Projeto Final",
    description: "Planejamento, produção e apresentação do ensaio.",
    lessons: [
      {
        order: 0,
        title: "Planejamento do Projeto Final",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Escolha do tema</li><li>Definição de público</li><li>Planejamento de ensaio</li><li>Orientação técnica</li></ul>`,
      },
      {
        order: 1,
        title: "Produção do Ensaio",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Sessão prática supervisionada</li><li>Produção de 5 a 10 fotos</li><li>Aplicação das técnicas</li></ul>`,
      },
      {
        order: 2,
        title: "Edição e Apresentação Final",
        contentHtml: `<p><strong>Conteúdo:</strong></p><ul><li>Seleção das melhores fotos</li><li>Edição final</li><li>Organização do portfólio</li><li>Apresentação e feedback</li></ul>`,
      },
    ],
  },
];

export async function seedFotografiaMobileModulesAndLessons(prisma: PrismaClient): Promise<void> {
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { slug: { equals: "fotografia-mobile", mode: "insensitive" } },
        { name: { equals: "Fotografia Mobile", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!course) {
    throw new Error(
      'Curso "Fotografia Mobile" não encontrado. Crie o curso com slug "fotografia-mobile" ou nome "Fotografia Mobile" (o seed principal já pode tê-lo criado).'
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

  console.log(`Curso "Fotografia Mobile": 5 módulos e 16 aulas criados/atualizados (20h).`);
}
