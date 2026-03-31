import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCourseLessonIdsInOrder } from "@/lib/course-modules";
import { notifyStudentsAfterHolidayScheduleResync } from "@/lib/holiday-schedule-notifications";
import { generateSessionsByWorkload, splitHolidaysForSchedule } from "@/lib/schedule";
import { getEndOfTodayBrazil } from "@/lib/brazil-today";

/** Transações com muitas sessões podem ultrapassar o padrão do Prisma (5s). */
const HOLIDAY_RESYNC_TX_MS = 300_000;

/** Datas sentinela (uma por índice) para liberar @@unique([classGroupId, sessionDate]) antes de aplicar as datas finais. */
function stagingSessionDate(index: number): Date {
  const base = Date.UTC(2099, 0, 1);
  return new Date(base + index * 86_400_000);
}

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

function hasDuplicateSessionDates(dates: Date[]): boolean {
  const seen = new Set<number>();
  for (const d of dates) {
    const t = d.getTime();
    if (seen.has(t)) return true;
    seen.add(t);
  }
  return false;
}

function scheduleDiffersFromComputed(
  cg: { endDate: Date | null; sessions: { sessionDate: Date; lessonId: string | null }[] },
  result: { dates: Date[]; endDate: Date },
  lessonIds: string[],
): boolean {
  const endA = cg.endDate?.getTime() ?? 0;
  const endB = result.endDate.getTime();
  if (endA !== endB) return true;
  if (cg.sessions.length !== result.dates.length) return true;
  for (let i = 0; i < result.dates.length; i++) {
    if (cg.sessions[i]!.sessionDate.getTime() !== result.dates[i]!.getTime()) return true;
    const want = lessonIds[i] ?? null;
    const have = cg.sessions[i]!.lessonId ?? null;
    if (want !== have) return true;
  }
  return false;
}

/**
 * Recalcula datas (e aulas vinculadas) de todas as turmas não encerradas, usando a lista atual de feriados/eventos ativos
 * e a mesma lógica de `generateSessionsByWorkload` da criação/edição de turma.
 *
 * Comportamento (alinhado a {@link generateSessionsByWorkload}):
 * - **Feriado de dia inteiro**: não há aula nessa data; a carga é cumprida avançando para as próximas datas
 *   válidas da turma (dias da semana cadastrados), como se o dia não existisse no calendário.
 * - **Evento com horário**: só “pula” o dia para turmas cujo intervalo de aula **cruza** o intervalo do evento;
 *   turmas em outro horário no mesmo dia mantêm a sessão.
 *
 * Preserva IDs das sessões quando a quantidade coincide (mantém frequência); caso contrário recria as sessões.
 */
export async function recalculateAllClassGroupSessionsAfterHolidayChange(): Promise<{
  classGroupsProcessed: number;
  classGroupsUpdated: number;
  classGroupIdsWithScheduleChange: string[];
  /** Notificações criadas no sino (soma por turma). */
  notificationsSent: number;
  /** Matrículas ignoradas no envio (sem conta, etc.). */
  notificationsSkipped: number;
  /** Turmas em que o envio de notificações falhou (erro). */
  notifyTurmaFailures: number;
}> {
  const holidays = await prisma.holiday.findMany({
    where: { isActive: true },
    select: { date: true, recurring: true, eventStartTime: true, eventEndTime: true },
  });

  const groups = await prisma.classGroup.findMany({
    where: { status: { not: "ENCERRADA" } },
    select: { id: true },
  });

  let classGroupsUpdated = 0;
  const classGroupIdsWithScheduleChange: string[] = [];
  let notificationsSent = 0;
  let notificationsSkipped = 0;
  let notifyTurmaFailures = 0;

  for (const { id: classGroupId } of groups) {
    const cg = await prisma.classGroup.findUnique({
      where: { id: classGroupId },
      include: {
        course: { select: { id: true, workloadHours: true } },
        sessions: { orderBy: { sessionDate: "asc" } },
      },
    });
    if (!cg) continue;

    const workloadHours = cg.course.workloadHours ?? 0;
    if (workloadHours <= 0) continue;

    const rangeStart = cg.startDate;
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setUTCFullYear(rangeEnd.getUTCFullYear() + 2);

    const { holidayDateStrings, holidayEventBlocks } = splitHolidaysForSchedule(
      holidays,
      rangeStart,
      rangeEnd,
    );

    let result: ReturnType<typeof generateSessionsByWorkload>;
    try {
      result = generateSessionsByWorkload({
        startDate: rangeStart,
        daysOfWeek: cg.daysOfWeek,
        startTime: cg.startTime,
        endTime: cg.endTime,
        workloadHours,
        holidayDateStrings,
        holidayEventBlocks,
      });
    } catch {
      continue;
    }

    const lessonIds = await getCourseLessonIdsInOrder(cg.courseId);
    if (!scheduleDiffersFromComputed(cg, result, lessonIds)) {
      continue;
    }

    const existing = cg.sessions;

    let done = false;
    try {
      done = await prisma.$transaction(
      async (tx) => {
        const canInPlaceUpdate =
          result.dates.length === existing.length &&
          existing.length > 0 &&
          !hasDuplicateSessionDates(result.dates);

        if (canInPlaceUpdate) {
          const rows = existing.map((s, i) => ({
            id: s.id,
            newDate: result.dates[i]!,
            lessonId: lessonIds[i] ?? null,
            wasCanceled: s.status === "CANCELED",
          }));

          // Duas fases: permutar datas quebra @@unique(classGroupId, sessionDate) se atualizarmos uma sessão
          // para uma data que outra sessão ainda ocupa. Primeiro cada linha vai para uma data sentinela única.
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
      },
      { timeout: HOLIDAY_RESYNC_TX_MS, maxWait: 60_000 },
    );
    } catch (e) {
      console.error(`[holiday-resync] classGroup ${classGroupId} transaction failed`, e);
      continue;
    }

    if (done) {
      classGroupsUpdated += 1;
      classGroupIdsWithScheduleChange.push(classGroupId);
      // Notificar logo após esta turma: se o lote final falhasse ou o processo parasse, as datas já estariam
      // gravadas sem aviso aos alunos.
      try {
        const n = await notifyStudentsAfterHolidayScheduleResync([classGroupId]);
        notificationsSent += n.sent;
        notificationsSkipped += n.skipped;
      } catch (e) {
        notifyTurmaFailures += 1;
        console.error("[holiday-resync] notify failed for classGroup", classGroupId, e);
      }
    }
  }

  return {
    classGroupsProcessed: groups.length,
    classGroupsUpdated,
    classGroupIdsWithScheduleChange,
    notificationsSent,
    notificationsSkipped,
    notifyTurmaFailures,
  };
}
