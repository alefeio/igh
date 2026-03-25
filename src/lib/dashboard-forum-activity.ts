import "server-only";

import { getCourseLessonIdsByCourseIds } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";

/** Aula no trilho do dashboard (com ou sem tópicos). */
export type DashboardForumLessonActivity = {
  courseId: string;
  courseName: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  topicCount: number;
  /** Última movimentação conhecida no fórum desta aula (tópicos; respostas podem não alterar updatedAt do tópico). */
  lastActivityAt: string;
  /** Aluno: primeira carta = última aula estudada, mesmo sem tópicos. */
  isLastStudiedLesson?: boolean;
  /** Texto mais recente (tópico ou resposta) nesta aula. */
  lastMessagePreview?: string | null;
};

const DEFAULT_LIMIT = 32;
const GLOBAL_LIMIT_DEFAULT = 80;

export type LastStudiedLessonForForumRail = {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  courseName: string;
  moduleTitle: string;
};

/**
 * Monta o trilho do aluno: em primeiro a última aula acessada (mesmo com 0 tópicos);
 * em seguida as aulas com interação, da mais antiga para a mais recente (a última carta = interação mais recente).
 */
export function buildStudentForumDashboardRail(
  activityLessons: DashboardForumLessonActivity[],
  lastStudied: LastStudiedLessonForForumRail | null
): DashboardForumLessonActivity[] {
  const byLessonId = new Map(activityLessons.map((a) => [a.lessonId, a]));
  const head: DashboardForumLessonActivity[] = [];
  if (lastStudied) {
    const existing = byLessonId.get(lastStudied.lessonId);
    head.push({
      courseId: lastStudied.courseId,
      courseName: lastStudied.courseName,
      lessonId: lastStudied.lessonId,
      lessonTitle: lastStudied.lessonTitle,
      moduleTitle: lastStudied.moduleTitle,
      topicCount: existing?.topicCount ?? 0,
      lastActivityAt: existing?.lastActivityAt ?? new Date(0).toISOString(),
      isLastStudiedLesson: true,
    });
  }
  const tail = activityLessons
    .filter((a) => a.lessonId !== lastStudied?.lessonId)
    .sort((a, b) => new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime());
  return [...head, ...tail];
}

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

/**
 * Todas as aulas da plataforma com pelo menos um tópico no fórum, para painel professor/admin.
 * Ordem: interação mais antiga primeiro, mais recente por último (fim da faixa horizontal).
 */
export async function getForumLessonsWithActivityGlobal(limit = GLOBAL_LIMIT_DEFAULT): Promise<DashboardForumLessonActivity[]> {
  const grouped = await prisma.enrollmentLessonQuestion.groupBy({
    by: ["lessonId"],
    _count: { id: true },
    _max: { updatedAt: true },
  });
  if (grouped.length === 0) return [];

  grouped.sort(
    (a, b) =>
      new Date(b._max.updatedAt ?? 0).getTime() - new Date(a._max.updatedAt ?? 0).getTime()
  );
  const top = grouped.slice(0, limit);

  const lessonIds = top.map((g) => g.lessonId);
  const lessons = await prisma.courseLesson.findMany({
    where: { id: { in: lessonIds }, module: { course: { status: "ACTIVE" } } },
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
  for (const g of top) {
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

  rows.sort((a, b) => new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime());
  return rows;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Última mensagem por aula (tópico ou resposta de aluno/professor/equipe), para o trilho do dashboard. */
export async function getLastForumMessagePreviewsByLessonIds(lessonIds: string[]): Promise<Map<string, string>> {
  const safe = [...new Set(lessonIds)].filter((id) => UUID_RE.test(id));
  const out = new Map<string, string>();
  if (safe.length === 0) return out;

  const inList = safe.map((id) => `'${id}'`).join(",");
  const rows = await prisma.$queryRawUnsafe<Array<{ lesson_id: string; content: string }>>(`
    SELECT DISTINCT ON (lesson_id) lesson_id::text, LEFT(TRIM(BOTH FROM content), 220) AS content
    FROM (
      SELECT q."lessonId" AS lesson_id, q.content, GREATEST(q."createdAt", q."updatedAt") AS t
      FROM "EnrollmentLessonQuestion" q
      WHERE q."lessonId"::text IN (${inList})
      UNION ALL
      SELECT q."lessonId", sr.content, sr."createdAt"
      FROM "EnrollmentLessonQuestionReply" sr
      INNER JOIN "EnrollmentLessonQuestion" q ON q.id = sr."questionId"
      WHERE q."lessonId"::text IN (${inList})
      UNION ALL
      SELECT q."lessonId", tr.content, tr."createdAt"
      FROM "LessonQuestionTeacherReply" tr
      INNER JOIN "EnrollmentLessonQuestion" q ON q.id = tr."questionId"
      WHERE q."lessonId"::text IN (${inList})
    ) sub
    ORDER BY lesson_id, t DESC
  `);

  for (const row of rows) {
    if (row.content?.trim()) out.set(row.lesson_id, row.content.trim());
  }
  return out;
}

export async function attachForumLastMessagePreviews(
  rows: DashboardForumLessonActivity[]
): Promise<DashboardForumLessonActivity[]> {
  if (rows.length === 0) return rows;
  const previews = await getLastForumMessagePreviewsByLessonIds(rows.map((r) => r.lessonId));
  return rows.map((r) => ({
    ...r,
    lastMessagePreview: previews.get(r.lessonId) ?? null,
  }));
}
