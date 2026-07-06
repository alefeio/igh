import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getEndOfTodayBrazil } from "@/lib/brazil-today";

/** Datas sentinela (uma por índice) para liberar @@unique([classGroupId, sessionDate]) antes de aplicar as datas finais. */
export function stagingSessionDate(index: number): Date {
  const base = Date.UTC(2099, 0, 1);
  return new Date(base + index * 86_400_000);
}

export function hasDuplicateSessionDates(dates: Date[]): boolean {
  const seen = new Set<number>();
  for (const d of dates) {
    const t = d.getTime();
    if (seen.has(t)) return true;
    seen.add(t);
  }
  return false;
}

export type ExistingSessionRow = {
  id: string;
  sessionDate: Date;
  lessonId: string | null;
  status: string;
};

async function syncLiberadaStatusesForClassGroup(
  tx: Prisma.TransactionClient,
  classGroupId: string
): Promise<void> {
  const endOfTodayBrazil = getEndOfTodayBrazil();
  await tx.classSession.updateMany({
    where: {
      classGroupId,
      status: "SCHEDULED",
      sessionDate: { lte: endOfTodayBrazil },
    },
    data: { status: "LIBERADA" },
  });
  await tx.classSession.updateMany({
    where: {
      classGroupId,
      status: "LIBERADA",
      sessionDate: { gt: endOfTodayBrazil },
    },
    data: { status: "SCHEDULED" },
  });
}

async function sessionIdsWithAttendance(
  tx: Prisma.TransactionClient,
  classGroupId: string
): Promise<Set<string>> {
  const rows = await tx.sessionAttendance.findMany({
    where: { classSession: { classGroupId } },
    select: { classSessionId: true },
    distinct: ["classSessionId"],
  });
  return new Set(rows.map((r) => r.classSessionId));
}

async function updateSessionsInPlace(
  tx: Prisma.TransactionClient,
  rows: Array<{
    id: string;
    newDate: Date;
    lessonId: string | null;
    wasCanceled: boolean;
    startTime: string;
    endTime: string;
  }>
): Promise<void> {
  if (rows.length === 0) return;

  for (let i = 0; i < rows.length; i++) {
    await tx.classSession.update({
      where: { id: rows[i]!.id },
      data: { sessionDate: stagingSessionDate(i) },
    });
  }

  for (const r of rows) {
    await tx.classSession.update({
      where: { id: r.id },
      data: {
        sessionDate: r.newDate,
        lessonId: r.lessonId,
        startTime: r.startTime,
        endTime: r.endTime,
        ...(r.wasCanceled ? { status: "CANCELED" as const } : {}),
      },
    });
  }
}

/**
 * Aplica novo cronograma de sessões. Se existir frequência lançada, **nunca** remove sessões
 * que tenham SessionAttendance — atualiza datas in-place por índice e mantém sessões extras com frequência.
 */
export async function applyClassGroupSessionSchedule(
  tx: Prisma.TransactionClient,
  opts: {
    classGroupId: string;
    existingSessions: ExistingSessionRow[];
    newDates: Date[];
    lessonIds: string[];
    startTime: string;
    endTime: string;
    endDate: Date;
  }
): Promise<{ sessionsCount: number }> {
  const { classGroupId, newDates, lessonIds, startTime, endTime, endDate } = opts;
  const existingSorted = [...opts.existingSessions].sort(
    (a, b) => a.sessionDate.getTime() - b.sessionDate.getTime()
  );

  const withAttendance = await sessionIdsWithAttendance(tx, classGroupId);
  const hasAttendance = withAttendance.size > 0;

  if (!hasAttendance) {
    await tx.classSession.deleteMany({ where: { classGroupId } });
    if (newDates.length > 0) {
      await tx.classSession.createMany({
        data: newDates.map((d, i) => ({
          classGroupId,
          sessionDate: d,
          startTime,
          endTime,
          status: "SCHEDULED" as const,
          lessonId: lessonIds[i] ?? null,
        })),
      });
    }
    await syncLiberadaStatusesForClassGroup(tx, classGroupId);
    await tx.classGroup.update({ where: { id: classGroupId }, data: { endDate } });
    return { sessionsCount: newDates.length };
  }

  const overlap = Math.min(newDates.length, existingSorted.length);

  if (overlap > 0 && !hasDuplicateSessionDates(newDates.slice(0, overlap))) {
    const rows = existingSorted.slice(0, overlap).map((s, i) => ({
      id: s.id,
      newDate: newDates[i]!,
      lessonId: lessonIds[i] ?? null,
      wasCanceled: s.status === "CANCELED",
      startTime,
      endTime,
    }));
    await updateSessionsInPlace(tx, rows);
  } else if (overlap > 0) {
    // Datas duplicadas no novo cronograma: só atualiza horário/aula sem mudar datas (preserva frequência).
    for (let i = 0; i < overlap; i++) {
      await tx.classSession.update({
        where: { id: existingSorted[i]!.id },
        data: {
          lessonId: lessonIds[i] ?? null,
          startTime,
          endTime,
        },
      });
    }
  }

  for (let i = existingSorted.length; i < newDates.length; i++) {
    await tx.classSession.create({
      data: {
        classGroupId,
        sessionDate: newDates[i]!,
        startTime,
        endTime,
        status: "SCHEDULED",
        lessonId: lessonIds[i] ?? null,
      },
    });
  }

  for (let i = newDates.length; i < existingSorted.length; i++) {
    const session = existingSorted[i]!;
    if (!withAttendance.has(session.id)) {
      await tx.classSession.delete({ where: { id: session.id } });
    } else {
      await tx.classSession.update({
        where: { id: session.id },
        data: { startTime, endTime },
      });
    }
  }

  await syncLiberadaStatusesForClassGroup(tx, classGroupId);
  await tx.classGroup.update({ where: { id: classGroupId }, data: { endDate } });

  const sessionsCount = await tx.classSession.count({ where: { classGroupId } });
  return { sessionsCount };
}

export async function classGroupHasSessionAttendance(
  tx: Prisma.TransactionClient,
  classGroupId: string
): Promise<boolean> {
  const n = await tx.sessionAttendance.count({
    where: { classSession: { classGroupId } },
  });
  return n > 0;
}
