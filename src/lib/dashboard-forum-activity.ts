import "server-only";

import { getCourseLessonIdsByCourseIds } from "@/lib/course-modules";
import { prisma } from "@/lib/prisma";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";

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
  /** Professor: sessão já realizada com esta aula (aparece no trilho mesmo sem tópicos). */
  isTaughtLesson?: boolean;
  /** Professor: esta é a última aula ministrada (cartão destacado no início do trilho). */
  isLastTaughtLesson?: boolean;
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

/**
 * Aulas já ministradas pelo professor (sessão com data ≤ hoje e lessonId preenchido),
 * para atalhos ao fórum mesmo sem tópicos. Ordem: mais antiga → mais recente (igual ao trilho global).
 */
export async function getForumLessonsFromTaughtSessions(teacherId: string): Promise<DashboardForumLessonActivity[]> {
  const today = getBrazilTodayDateOnly();

  const sessions = await prisma.classSession.findMany({
    where: {
      lessonId: { not: null },
      sessionDate: { lte: today },
      classGroup: { teacherId },
    },
    select: {
      lessonId: true,
      sessionDate: true,
    },
  });

  const lessonIds = [...new Set(sessions.map((s) => s.lessonId).filter((id): id is string => id != null))];
  if (lessonIds.length === 0) return [];

  const lastSessionByLesson = new Map<string, Date>();
  for (const s of sessions) {
    if (!s.lessonId) continue;
    const d = s.sessionDate;
    const prev = lastSessionByLesson.get(s.lessonId);
    if (!prev || d > prev) lastSessionByLesson.set(s.lessonId, d);
  }

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

  const topicAgg =
    lessonIds.length > 0
      ? await prisma.enrollmentLessonQuestion.groupBy({
          by: ["lessonId"],
          where: { lessonId: { in: lessonIds } },
          _count: { id: true },
          _max: { updatedAt: true },
        })
      : [];
  const topicByLesson = new Map(
    topicAgg.map((g) => [g.lessonId, { n: g._count.id, max: g._max.updatedAt }]),
  );

  const rows: DashboardForumLessonActivity[] = [];
  for (const l of lessons) {
    const t = topicByLesson.get(l.id);
    const sessionD = lastSessionByLesson.get(l.id);
    const forumT = t?.max?.getTime() ?? 0;
    const sessionT = sessionD ? sessionD.getTime() : 0;
    const lastActivityAt = new Date(Math.max(forumT, sessionT)).toISOString();

    rows.push({
      courseId: l.module.courseId,
      courseName: l.module.course.name,
      lessonId: l.id,
      lessonTitle: l.title,
      moduleTitle: l.module.title,
      topicCount: t?.n ?? 0,
      lastActivityAt,
      isTaughtLesson: true,
    });
  }

  rows.sort((a, b) => new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime());
  return rows;
}

/**
 * União do trilho global (atividade na plataforma) com aulas já lecionadas pelo professor.
 */
export function mergeTeacherForumGlobalAndTaught(
  global: DashboardForumLessonActivity[],
  taught: DashboardForumLessonActivity[],
): DashboardForumLessonActivity[] {
  const map = new Map<string, DashboardForumLessonActivity>();

  for (const item of taught) {
    map.set(item.lessonId, { ...item });
  }
  for (const item of global) {
    const existing = map.get(item.lessonId);
    if (!existing) {
      map.set(item.lessonId, { ...item });
    } else {
      const lastMs = Math.max(
        new Date(existing.lastActivityAt).getTime(),
        new Date(item.lastActivityAt).getTime(),
      );
      map.set(item.lessonId, {
        ...existing,
        topicCount: Math.max(existing.topicCount, item.topicCount),
        lastActivityAt: new Date(lastMs).toISOString(),
        isTaughtLesson: Boolean(existing.isTaughtLesson || item.isTaughtLesson),
      });
    }
  }

  const arr = [...map.values()];
  arr.sort((a, b) => new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime());
  return arr;
}

/** Sessão de aula mais recente já realizada (data ≤ hoje) com `lessonId`, para o professor. */
export async function getLastTaughtLessonIdForTeacher(teacherId: string): Promise<string | null> {
  const today = getBrazilTodayDateOnly();
  const s = await prisma.classSession.findFirst({
    where: {
      lessonId: { not: null },
      sessionDate: { lte: today },
      classGroup: { teacherId },
    },
    orderBy: [{ sessionDate: "desc" }, { id: "desc" }],
    select: { lessonId: true },
  });
  return s?.lessonId ?? null;
}

/**
 * Coloca a última aula lecionada na primeira posição do trilho (resto mantém a ordem anterior).
 */
export function putLastTaughtLessonFirstForTeacher(
  items: DashboardForumLessonActivity[],
  lastTaughtLessonId: string | null,
): DashboardForumLessonActivity[] {
  if (lastTaughtLessonId == null || items.length === 0) return items;

  const idx = items.findIndex((i) => i.lessonId === lastTaughtLessonId);
  if (idx < 0) return items;

  const head = items[idx];
  const rest = items
    .filter((_, i) => i !== idx)
    .map((r) => ({ ...r, isLastTaughtLesson: false }));

  return [
    {
      ...head,
      isLastTaughtLesson: true,
      isTaughtLesson: head.isTaughtLesson ?? true,
    },
    ...rest,
  ];
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

/**
 * Fórum do dashboard do aluno: uma entrada por aula com progresso (acesso ou conclusão),
 * com contagem de tópicos quando existir. Ordenação: último estudo primeiro.
 */
export async function getStudentAttendedLessonsForumActivities(
  enrollmentIds: string[],
  limit = 96
): Promise<DashboardForumLessonActivity[]> {
  if (enrollmentIds.length === 0) return [];

  const progressList = await prisma.enrollmentLessonProgress.findMany({
    where: {
      enrollmentId: { in: enrollmentIds },
      OR: [
        { lastAccessedAt: { not: null } },
        { completed: true },
        { percentWatched: { gt: 0 } },
        { percentRead: { gt: 0 } },
      ],
    },
    select: {
      lessonId: true,
      lastAccessedAt: true,
      lesson: {
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
      },
    },
  });

  if (progressList.length === 0) return [];

  type Best = { lastStudiedAt: Date; lesson: (typeof progressList)[0]["lesson"] };
  const byLesson = new Map<string, Best>();
  for (const r of progressList) {
    const la = r.lastAccessedAt ?? new Date(0);
    const cur = byLesson.get(r.lessonId);
    if (!cur || la > cur.lastStudiedAt) {
      byLesson.set(r.lessonId, { lastStudiedAt: la, lesson: r.lesson });
    }
  }

  const lessonIds = [...byLesson.keys()];
  const topicAgg =
    lessonIds.length > 0
      ? await prisma.enrollmentLessonQuestion.groupBy({
          by: ["lessonId"],
          where: { lessonId: { in: lessonIds } },
          _count: { id: true },
          _max: { updatedAt: true },
        })
      : [];
  const topicByLesson = new Map(
    topicAgg.map((g) => [g.lessonId, { n: g._count.id, max: g._max.updatedAt }])
  );

  const rows: (DashboardForumLessonActivity & { lastStudiedAt: Date })[] = [];
  for (const [lessonId, { lastStudiedAt, lesson: l }] of byLesson) {
    const t = topicByLesson.get(lessonId);
    const forumAt = t?.max;
    const studiedT = lastStudiedAt.getTime();
    const forumT = forumAt ? forumAt.getTime() : 0;
    const lastActivityAt = new Date(Math.max(studiedT, forumT)).toISOString();

    rows.push({
      courseId: l.module.courseId,
      courseName: l.module.course.name,
      lessonId: l.id,
      lessonTitle: l.title,
      moduleTitle: l.module.title,
      topicCount: t?.n ?? 0,
      lastActivityAt,
      lastStudiedAt,
    });
  }

  rows.sort((a, b) => b.lastStudiedAt.getTime() - a.lastStudiedAt.getTime());
  const sliced = rows.slice(0, limit).map(({ lastStudiedAt: _ls, ...rest }, i) => ({
    ...rest,
    isLastStudiedLesson: i === 0,
  }));
  return sliced;
}
