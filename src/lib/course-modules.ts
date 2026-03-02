import "server-only";
import { prisma } from "@/lib/prisma";

export type LessonForList = {
  id: string;
  title: string;
  order: number;
  durationMinutes: number | null;
  contentRich: string | null;
};

export type ModuleWithLessons = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: LessonForList[];
};

/**
 * Lista todos os módulos de um curso com suas aulas, ordenados.
 */
export async function getModulesWithLessonsByCourseId(
  courseId: string
): Promise<ModuleWithLessons[]> {
  const modules = await prisma.courseModule.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          order: true,
          durationMinutes: true,
          contentRich: true,
        },
      },
    },
  });
  return modules.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    order: m.order,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      order: l.order,
      durationMinutes: l.durationMinutes,
      contentRich: l.contentRich,
    })),
  }));
}

/**
 * Busca curso por slug ou nome (ex.: "computacao" ou "Computação").
 */
export async function findCourseBySlugOrName(
  slugOrName: string
): Promise<{ id: string; name: string; slug: string } | null> {
  const normalized = slugOrName.trim().toLowerCase();
  const course = await prisma.course.findFirst({
    where: {
      OR: [
        { slug: { equals: normalized, mode: "insensitive" } },
        { name: { contains: slugOrName.trim(), mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true },
  });
  return course;
}
