import "server-only";

import { getCourseLessonIdsByCourseIds } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";

/** Aula (curso) com pelo menos um tópico no fórum — qualquer aluno/professor do curso. */
export type DashboardForumLessonActivity = {
  courseId: string;
  courseName: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  topicCount: number;
  /** Última movimentação conhecida no fórum desta aula (tópicos; respostas podem não alterar updatedAt do tópico). */
  lastActivityAt: string;
};

const DEFAULT_LIMIT = 32;

/**
 * Lista aulas dos cursos indicados que já têm pelo menos um tópico (`EnrollmentLessonQuestion`),
 * ordenadas pela atividade mais recente (updatedAt do tópico).
 */
export async function getForumLessonsWithActivityForCourses(
  courseIds: string[],
  limit = DEFAULT_LIMIT
): Promise<DashboardForumLessonActivity[]> {
  if (courseIds.length === 0) return [];

  const scopedLessonIds = await getCourseLessonIdsByCourseIds(courseIds);
  if (scopedLessonIds.length === 0) return [];

  const grouped = await prisma.enrollmentLessonQuestion.groupBy({
    by: ["lessonId"],
    where: { lessonId: { in: scopedLessonIds } },
    _count: { id: true },
    _max: { updatedAt: true },
  });
  if (grouped.length === 0) return [];

  const lessonIds = grouped.map((g) => g.lessonId);
  const lessons = await prisma.courseLesson.findMany({
    where: { id: { in: lessonIds } },
    select: {
      id: true,
      title: true,
      module: {
        select: {
          title: true,
          courseId: true,
          course: { select: { name: true } },
        },
      },
    },
  });
  const lessonMap = new Map(lessons.map((l) => [l.id, l]));

  const rows: DashboardForumLessonActivity[] = [];
  for (const g of grouped) {
    const l = lessonMap.get(g.lessonId);
    if (!l) continue;
    const last = g._max.updatedAt ?? new Date(0);
    rows.push({
      courseId: l.module.courseId,
      courseName: l.module.course.name,
      lessonId: l.id,
      lessonTitle: l.title,
      moduleTitle: l.module.title,
      topicCount: g._count.id,
      lastActivityAt: last.toISOString(),
    });
  }

  rows.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  return rows.slice(0, limit);
}
