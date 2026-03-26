import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PLATFORM_EXPERIENCE_SORT,
  type PlatformExperienceSort,
} from "@/lib/platform-experience-sort";

const DEFAULT_LIST_LIMIT = 500;

function parseDateStart(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseAdminPlatformFeedbackQuery(searchParams: URLSearchParams): {
  sort: PlatformExperienceSort;
  courseId: string | null;
  teacherId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
} {
  const sortRaw = searchParams.get("sort") ?? "newest";
  const sort = PLATFORM_EXPERIENCE_SORT.includes(sortRaw as PlatformExperienceSort)
    ? (sortRaw as PlatformExperienceSort)
    : "newest";
  const courseId = searchParams.get("courseId")?.trim() || null;
  const teacherId = searchParams.get("teacherId")?.trim() || null;
  const df = searchParams.get("dateFrom")?.trim();
  const dt = searchParams.get("dateTo")?.trim();
  return {
    sort,
    courseId,
    teacherId,
    dateFrom: df ? parseDateStart(df) : null,
    dateTo: dt ? parseDateEnd(dt) : null,
  };
}

/**
 * Alunos (userId) com matrícula ativa cuja turma atende ao curso e/ou professor informados.
 */
export async function getUserIdsForTurmaFilters(
  courseId: string | null,
  teacherId: string | null,
): Promise<string[] | null> {
  if (!courseId && !teacherId) return null;

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      student: { deletedAt: null, userId: { not: null } },
      classGroup: {
        ...(courseId ? { courseId } : {}),
        ...(teacherId ? { teacherId } : {}),
      },
    },
    select: { student: { select: { userId: true } } },
  });

  const userIds = [
    ...new Set(
      enrollments
        .map((e) => e.student.userId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  return userIds;
}

function buildWhereParts(
  userIds: string[] | null,
  dateFrom: Date | null,
  dateTo: Date | null,
): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [];
  if (userIds !== null) {
    parts.push(Prisma.sql`f."userId" IN (${Prisma.join(userIds)})`);
  }
  if (dateFrom) {
    parts.push(Prisma.sql`f."createdAt" >= ${dateFrom}`);
  }
  if (dateTo) {
    parts.push(Prisma.sql`f."createdAt" <= ${dateTo}`);
  }
  return parts;
}

function buildPrismaWhere(
  userIds: string[] | null,
  dateFrom: Date | null,
  dateTo: Date | null,
): Prisma.PlatformExperienceFeedbackWhereInput {
  if (userIds !== null && userIds.length === 0) {
    return { id: { in: [] } };
  }
  const and: Prisma.PlatformExperienceFeedbackWhereInput[] = [];
  if (userIds !== null) {
    and.push({ userId: { in: userIds } });
  }
  if (dateFrom || dateTo) {
    and.push({
      createdAt: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      },
    });
  }
  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { AND: and };
}

async function fetchRowsByOrderedIds(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await prisma.platformExperienceFeedback.findMany({
    where: { id: { in: ids } },
    include: { user: { select: { name: true, email: true } } },
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return rows;
}

async function queryIdsByTotalScore(
  whereParts: Prisma.Sql[],
  direction: "asc" | "desc",
  takeLimit: number,
): Promise<string[]> {
  const whereSql =
    whereParts.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(whereParts, " AND ")}`
      : Prisma.sql`WHERE 1=1`;
  const orderDir = direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT f.id
    FROM "PlatformExperienceFeedback" f
    ${whereSql}
    ORDER BY (f."ratingPlatform" + f."ratingLessons" + f."ratingTeacher") ${orderDir}
    LIMIT ${takeLimit}
  `);
  return rows.map((r) => r.id);
}

export async function listAdminPlatformExperienceFeedback(params: {
  sort: PlatformExperienceSort;
  courseId: string | null;
  teacherId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  /** Limite de linhas (lista: 500; export: 10000). */
  takeLimit?: number;
}) {
  const { sort, courseId, teacherId, dateFrom, dateTo } = params;
  const takeLimit = params.takeLimit ?? DEFAULT_LIST_LIMIT;

  const userIds = await getUserIdsForTurmaFilters(courseId, teacherId);
  if (userIds !== null && userIds.length === 0) {
    return {
      rows: [],
      where: buildPrismaWhere(userIds, dateFrom, dateTo),
    };
  }

  const prismaWhere = buildPrismaWhere(userIds, dateFrom, dateTo);
  const rawParts = buildWhereParts(userIds, dateFrom, dateTo);

  if (sort === "newest") {
    const rows = await prisma.platformExperienceFeedback.findMany({
      where: prismaWhere,
      orderBy: { createdAt: "desc" },
      take: takeLimit,
      include: { user: { select: { name: true, email: true } } },
    });
    return { rows, where: prismaWhere };
  }

  if (sort === "oldest") {
    const rows = await prisma.platformExperienceFeedback.findMany({
      where: prismaWhere,
      orderBy: { createdAt: "asc" },
      take: takeLimit,
      include: { user: { select: { name: true, email: true } } },
    });
    return { rows, where: prismaWhere };
  }

  const ids = await queryIdsByTotalScore(
    rawParts,
    sort === "best" ? "desc" : "asc",
    takeLimit,
  );
  const rows = await fetchRowsByOrderedIds(ids);
  return { rows, where: prismaWhere };
}

export async function loadAdminFilterOptions() {
  const [courses, teachers] = await Promise.all([
    prisma.course.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.teacher.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { courses, teachers };
}
