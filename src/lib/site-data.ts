import "server-only";
import { prisma } from "@/lib/prisma";

export type FormationWithCourses = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  audience: string | null;
  outcomes: string[];
  finalProject: string | null;
  prerequisites: string | null;
  order: number;
  isActive: boolean;
  courses: {
    order: number;
    course: {
      id: string;
      name: string;
      description: string | null;
      content: string | null;
      imageUrl: string | null;
      workloadHours: number | null;
      status: string;
    };
  }[];
};

export type HowFormationWorksItem = {
  titulo: string;
  descricao: string;
};

const COMO_FUNCIONA_FALLBACK: HowFormationWorksItem[] = [
  { titulo: "Núcleo Comum", descricao: "Conteúdo base em tecnologia e competências transversais para todas as trilhas." },
  { titulo: "Trilha Técnica", descricao: "Módulos específicos da área escolhida, com foco em prática e ferramentas atuais." },
  { titulo: "Projeto Integrador", descricao: "Projeto real desenvolvido ao longo da formação, que compõe seu portfólio." },
  { titulo: "Carreira e Demo Day", descricao: "Preparação para o mercado, networking e apresentação dos projetos." },
];

export async function getFormationsWithCourses(): Promise<FormationWithCourses[]> {
  const list = await prisma.siteFormation.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      courses: {
        orderBy: { order: "asc" },
        include: {
          course: {
            select: {
              id: true,
              name: true,
              description: true,
              content: true,
              imageUrl: true,
              workloadHours: true,
              status: true,
            },
          },
        },
      },
    },
  });
  return list.map((f) => ({
    id: f.id,
    title: f.title,
    slug: f.slug,
    summary: f.summary,
    audience: f.audience,
    outcomes: f.outcomes,
    finalProject: f.finalProject,
    prerequisites: f.prerequisites,
    order: f.order,
    isActive: f.isActive,
    courses: f.courses.map((fc) => ({
      order: fc.order,
      course: {
        ...fc.course,
        status: fc.course.status,
      },
    })),
  }));
}

export async function getFormationsForHome(limit = 4): Promise<FormationWithCourses[]> {
  const all = await getFormationsWithCourses();
  return all.slice(0, limit);
}

export function getComoFuncionaFormacao(): HowFormationWorksItem[] {
  return COMO_FUNCIONA_FALLBACK;
}
