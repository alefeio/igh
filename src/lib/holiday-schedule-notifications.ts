import "server-only";

import { randomUUID } from "node:crypto";

import {
  bodyHolidayScheduleResync,
  enrollmentSchedulePageUrl,
  titleScheduleChange,
} from "@/lib/class-schedule-notification-text";
import { prisma } from "@/lib/prisma";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

export type HolidayScheduleNotifyResult = {
  /** Notificações criadas com sucesso. */
  sent: number;
  /** Matrículas ignoradas (sem conta ou já tinham aviso de feriado/evento, conforme opção). */
  skipped: number;
};

const HOLIDAY_RESYNC_DEDUPE_PREFIX = "holiday_resync:";

function parseEnrollmentIdFromHolidayDedupeKey(dedupeKey: string): string | null {
  if (!dedupeKey.startsWith(HOLIDAY_RESYNC_DEDUPE_PREFIX)) return null;
  const rest = dedupeKey.slice(HOLIDAY_RESYNC_DEDUPE_PREFIX.length);
  const colon = rest.indexOf(":");
  if (colon <= 0) return null;
  return rest.slice(0, colon) || null;
}

/**
 * Notifica alunos com conta ativa quando o calendário da turma foi recalculado por feriado/evento.
 *
 * @param skipIfAlreadyNotified — Se true, não cria notificação para matrículas que já tenham qualquer aviso
 *   `holiday_resync` (útil no botão “Reenviar aviso no sino”). O recálculo automático usa false.
 */
export async function notifyStudentsAfterHolidayScheduleResync(
  classGroupIds: string[],
  options?: { skipIfAlreadyNotified?: boolean },
): Promise<HolidayScheduleNotifyResult> {
  const skipIfAlready = options?.skipIfAlreadyNotified === true;
  const unique = [...new Set(classGroupIds)].filter(Boolean);
  if (unique.length === 0) return { sent: 0, skipped: 0 };

  const batchId = randomUUID();
  const enrollments = await prisma.enrollment.findMany({
    where: { classGroupId: { in: unique }, status: "ACTIVE" },
    select: {
      id: true,
      student: { select: { userId: true } },
      classGroup: { select: { course: { select: { name: true } } } },
    },
  });

  const userIds = [...new Set(enrollments.map((e) => e.student.userId).filter(Boolean))] as string[];

  let enrollmentIdsAlreadyNotified = new Set<string>();
  if (skipIfAlready && userIds.length > 0) {
    const existing = await prisma.userNotification.findMany({
      where: {
        userId: { in: userIds },
        kind: "CLASS_SCHEDULE_CHANGED",
        dedupeKey: { startsWith: HOLIDAY_RESYNC_DEDUPE_PREFIX },
      },
      select: { dedupeKey: true },
    });
    for (const row of existing) {
      const eid = parseEnrollmentIdFromHolidayDedupeKey(row.dedupeKey);
      if (eid) enrollmentIdsAlreadyNotified.add(eid);
    }
  }

  let sent = 0;
  let skipped = 0;

  for (const e of enrollments) {
    if (!e.student.userId) {
      skipped += 1;
      continue;
    }
    if (skipIfAlready && enrollmentIdsAlreadyNotified.has(e.id)) {
      skipped += 1;
      continue;
    }
    const courseName = e.classGroup.course.name;
    const created = await createUserNotificationIfNew({
      userId: e.student.userId,
      kind: "CLASS_SCHEDULE_CHANGED",
      title: titleScheduleChange(courseName),
      body: bodyHolidayScheduleResync(courseName),
      linkUrl: enrollmentSchedulePageUrl(e.id),
      dedupeKey: `holiday_resync:${e.id}:${batchId}`,
    });
    if (created) {
      sent += 1;
    } else {
      skipped += 1;
    }
  }

  return { sent, skipped };
}
