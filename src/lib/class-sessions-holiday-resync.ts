import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import {
  expandHolidaysToDateStrings,
  generateSessionsByWorkload,
} from "@/lib/schedule";
import { getEndOfTodayBrazil } from "@/lib/brazil-today";

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

/**
 * Recalcula datas (e aulas vinculadas) de todas as turmas não encerradas, usando a lista atual de feriados ativos
 * e a mesma lógica de `generateSessionsByWorkload` da criação/edição de turma.
 * Preserva IDs das sessões quando a quantidade coincide (mantém frequência); caso contrário recria as sessões.
 */
export async function recalculateAllClassGroupSessionsAfterHolidayChange(): Promise<{
  classGroupsProcessed: number;
  classGroupsUpdated: number;
}> {
  const holidays = await prisma.holiday.findMany({
    where: { isActive: true },
    select: { date: true, recurring: true },
  });

  const groups = await prisma.classGroup.findMany({
    where: { status: { not: "ENCERRADA" } },
    select: { id: true },
  });

  let classGroupsUpdated = 0;

  for (const { id: classGroupId } of groups) {
    const done = await prisma.$transaction(async (tx) => {
      const cg = await tx.classGroup.findUnique({
        where: { id: classGroupId },
        include: {
          course: { select: { id: true, workloadHours: true } },
          sessions: { orderBy: { sessionDate: "asc" } },
        },
      });
      if (!cg) return false;

      const workloadHours = cg.course.workloadHours ?? 0;
      if (workloadHours <= 0) return false;

      const rangeStart = cg.startDate;
      const rangeEnd = new Date(rangeStart);
      rangeEnd.setUTCFullYear(rangeEnd.getUTCFullYear() + 2);

      const holidayDateStrings = expandHolidaysToDateStrings(holidays, rangeStart, rangeEnd);

      let result: ReturnType<typeof generateSessionsByWorkload>;
      try {
        result = generateSessionsByWorkload({
          startDate: rangeStart,
          daysOfWeek: cg.daysOfWeek,
          startTime: cg.startTime,
          endTime: cg.endTime,
          workloadHours,
          holidayDateStrings,
        });
      } catch {
        return false;
      }

      const lessonIds = await getCourseLessonIdsInOrder(cg.courseId);
      const existing = cg.sessions;

      if (result.dates.length === existing.length && existing.length > 0) {
        const rows = existing.map((s, i) => ({
          id: s.id,
          newDate: result.dates[i]!,
          lessonId: lessonIds[i] ?? null,
          wasCanceled: s.status === "CANCELED",
        }));
        rows.sort((a, b) => b.newDate.getTime() - a.newDate.getTime());

        for (const r of rows) {
          await tx.classSession.update({
            where: { id: r.id },
            data: {
              sessionDate: r.newDate,
              lessonId: r.lessonId,
              startTime: cg.startTime,
              endTime: cg.endTime,
            },
          });
        }

        for (const r of rows) {
          if (r.wasCanceled) {
            await tx.classSession.update({
              where: { id: r.id },
              data: { status: "CANCELED" },
            });
          }
        }

        await syncLiberadaStatusesForClassGroup(tx, classGroupId);

        await tx.classGroup.update({
          where: { id: classGroupId },
          data: { endDate: result.endDate },
        });
        return true;
      }

      // Quantidade diferente ou sem sessões: recria (pode perder frequência se houvesse sessões antigas)
      await tx.classSession.deleteMany({ where: { classGroupId } });

      if (result.dates.length > 0) {
        await tx.classSession.createMany({
          data: result.dates.map((d, i) => ({
            classGroupId,
            sessionDate: d,
            startTime: cg.startTime,
            endTime: cg.endTime,
            status: "SCHEDULED",
            lessonId: lessonIds[i] ?? null,
          })),
        });
      }

      await syncLiberadaStatusesForClassGroup(tx, classGroupId);

      await tx.classGroup.update({
        where: { id: classGroupId },
        data: { endDate: result.endDate },
      });
      return true;
    });

    if (done) classGroupsUpdated += 1;
  }

  return { classGroupsProcessed: groups.length, classGroupsUpdated };
}
