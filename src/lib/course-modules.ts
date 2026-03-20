import "server-only";
import { prisma } from "@/lib/prisma";

export type LessonForList = {
  id: string;
  title: string;
  order: number;
  durationMinutes: number | null;
  videoUrl: string | null;
  imageUrls: string[];
  contentRich: string | null;
  summary: string | null;
  pdfUrl: string | null;
  attachmentUrls: string[];
  attachmentNames: string[];
  lastEditedAt: Date | null;
  lastEditedByUserName: string | null;
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
          videoUrl: true,
          imageUrls: true,
          contentRich: true,
          summary: true,
          pdfUrl: true,
          attachmentUrls: true,
          attachmentNames: true,
          lastEditedAt: true,
          lastEditedByUser: { select: { name: true } },
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
      videoUrl: l.videoUrl,
      imageUrls: l.imageUrls ?? [],
      contentRich: l.contentRich,
      summary: l.summary,
      pdfUrl: l.pdfUrl,
      attachmentUrls: l.attachmentUrls ?? [],
      attachmentNames: l.attachmentNames ?? [],
      lastEditedAt: l.lastEditedAt,
      lastEditedByUserName: l.lastEditedByUser?.name ?? null,
    })),
  }));
}

/**
 * Retorna os IDs das aulas do curso na ordem em que aparecem (módulos ordenados, aulas ordenadas).
 * Usado para associar cada sessão da turma à aula do curso correspondente.
 */
export async function getCourseLessonIdsInOrder(courseId: string): Promise<string[]> {
  const modules = await prisma.courseModule.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    select: {
      lessons: {
        orderBy: { order: "asc" },
        select: { id: true },
      },
    },
  });
  return modules.flatMap((m) => m.lessons.map((l) => l.id));
}

/**
 * IDs de todas as aulas dos cursos indicados (via módulos).
 * `EnrollmentLessonQuestion` só tem `lessonId` (sem relação Prisma `lesson`); use este helper para filtrar por curso.
 */
export async function getCourseLessonIdsByCourseIds(courseIds: string[]): Promise<string[]> {
  if (courseIds.length === 0) return [];
  const rows = await prisma.courseLesson.findMany({
    where: { module: { courseId: { in: courseIds } } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
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
