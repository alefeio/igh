import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

/** Resumo agregado por turma (sem uma linha por aula). */
export type AttendanceClassGroupSummaryRow = {
  classGroupId: string;
  courseId: string;
  courseName: string;
  /** Identificação da turma: data de início e, se houver, local. */
  turmaLabel: string;
  /** Dias da semana e horário padrão da turma. */
  horarioLabel: string;
  teacherName: string;
  /** Aulas (sessões) cadastradas para a turma. */
  sessionCount: number;
  presentSum: number;
  absentSum: number;
  justifiedAbsentSum: number;
};

export type AttendanceTotals = {
  presentSum: number;
  absentSum: number;
  justifiedAbsentSum: number;
  /** Total de aulas (ClassSession) no escopo do filtro. */
  sessionCount: number;
  /** Turmas no escopo do filtro. */
  classGroupCount: number;
};

export const EMPTY_ATTENDANCE_TOTALS: AttendanceTotals = {
  presentSum: 0,
  absentSum: 0,
  justifiedAbsentSum: 0,
  sessionCount: 0,
  classGroupCount: 0,
};

type SummaryConfig = {
  classGroupId?: string;
  /** Se definido, só turmas deste professor. */
  teacherId?: string;
};

function classGroupWhere(config: SummaryConfig) {
  return {
    ...(config.classGroupId ? { id: config.classGroupId } : {}),
    ...(config.teacherId ? { teacherId: config.teacherId } : {}),
  };
}

function sessionWhere(config: SummaryConfig) {
  return {
    ...(config.classGroupId ? { classGroupId: config.classGroupId } : {}),
    ...(config.teacherId ? { classGroup: { teacherId: config.teacherId } } : {}),
  };
}

function attendanceWhere(config: SummaryConfig) {
  return {
    classSession: {
      ...(config.classGroupId ? { classGroupId: config.classGroupId } : {}),
      ...(config.teacherId ? { classGroup: { teacherId: config.teacherId } } : {}),
    },
  };
}

/** Totais globais no escopo do filtro (contagens em SessionAttendance / ClassSession / ClassGroup). */
export async function getAttendanceTotals(config: SummaryConfig): Promise<AttendanceTotals> {
  const cgWhere = classGroupWhere(config);
  const sessWhere = sessionWhere(config);
  const attWhere = attendanceWhere(config);

  const justifiedAbsent = {
    present: false as const,
    absenceJustification: { not: null },
    NOT: { absenceJustification: { equals: "" } },
  };

  const [presentSum, justifiedAbsentSum, absentSum, sessionCount, classGroupCount] = await Promise.all([
    prisma.sessionAttendance.count({ where: { ...attWhere, present: true } }),
    prisma.sessionAttendance.count({ where: { ...attWhere, ...justifiedAbsent } }),
    prisma.sessionAttendance.count({ where: { ...attWhere, present: false } }),
    prisma.classSession.count({ where: sessWhere }),
    prisma.classGroup.count({ where: cgWhere }),
  ]);

  return {
    presentSum,
    absentSum,
    justifiedAbsentSum,
    sessionCount,
    classGroupCount,
  };
}

function formatHorarioLabel(daysOfWeek: string[], startTime: string, endTime: string): string {
  const days = Array.isArray(daysOfWeek) && daysOfWeek.length ? daysOfWeek.join(", ") : "—";
  return `${days} · ${startTime}–${endTime}`;
}

function formatStartDatePtBr(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(y, mo, day).toLocaleDateString("pt-BR");
}

function buildTurmaLabel(startDate: Date, location: string | null): string {
  const dateStr = formatStartDatePtBr(startDate);
  const loc = location?.trim();
  return loc ? `${dateStr} · ${loc}` : dateStr;
}

/**
 * Resumo de frequência: uma linha por turma, com agregação no banco (sem listar cada aula).
 */
export async function getAttendanceOverview(config: SummaryConfig): Promise<{
  groups: AttendanceClassGroupSummaryRow[];
  totals: AttendanceTotals;
}> {
  const totals = await getAttendanceTotals(config);

  const groupsMeta = await prisma.classGroup.findMany({
    where: classGroupWhere(config),
    select: {
      id: true,
      courseId: true,
      startDate: true,
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      location: true,
      course: { select: { name: true } },
      teacher: { select: { name: true } },
    },
    orderBy: [{ course: { name: "asc" } }, { startTime: "asc" }],
  });

  if (groupsMeta.length === 0) {
    return { groups: [], totals };
  }

  const ids = groupsMeta.map((g) => g.id);

  const agg = await prisma.$queryRaw<
    Array<{
      classGroupId: string;
      sessionCount: number;
      presentSum: bigint;
      absentSum: bigint;
      justifiedAbsentSum: bigint;
    }>
  >(Prisma.sql`
    SELECT
      cg."id" AS "classGroupId",
      COUNT(DISTINCT cs."id")::int AS "sessionCount",
      COALESCE(SUM(CASE WHEN sa."present" THEN 1 ELSE 0 END), 0)::bigint AS "presentSum",
      COALESCE(SUM(CASE WHEN sa."present" = false THEN 1 ELSE 0 END), 0)::bigint AS "absentSum",
      COALESCE(
        SUM(
          CASE
            WHEN sa."present" = false AND COALESCE(TRIM(sa."absenceJustification"), '') <> ''
            THEN 1
            ELSE 0
          END
        ),
        0
      )::bigint AS "justifiedAbsentSum"
    FROM "ClassGroup" cg
    LEFT JOIN "ClassSession" cs ON cs."classGroupId" = cg."id"
    LEFT JOIN "SessionAttendance" sa ON sa."classSessionId" = cs."id"
    WHERE cg."id" IN (${Prisma.join(ids)})
    GROUP BY cg."id"
  `);

  const statMap = new Map(
    agg.map((r) => [
      r.classGroupId,
      {
        sessionCount: r.sessionCount,
        presentSum: Number(r.presentSum),
        absentSum: Number(r.absentSum),
        justifiedAbsentSum: Number(r.justifiedAbsentSum),
      },
    ]),
  );

  const groups: AttendanceClassGroupSummaryRow[] = groupsMeta.map((g) => {
    const s = statMap.get(g.id);
    return {
      classGroupId: g.id,
      courseId: g.courseId,
      courseName: g.course.name,
      turmaLabel: buildTurmaLabel(g.startDate, g.location),
      horarioLabel: formatHorarioLabel(g.daysOfWeek, g.startTime, g.endTime),
      teacherName: g.teacher.name,
      sessionCount: s?.sessionCount ?? 0,
      presentSum: s?.presentSum ?? 0,
      absentSum: s?.absentSum ?? 0,
      justifiedAbsentSum: s?.justifiedAbsentSum ?? 0,
    };
  });

  return { groups, totals };
}
