import "server-only";

import { UserNotificationKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

export type BirthdayNotifyRunResult = {
  /** Notificações criadas (novas). */
  sent: number;
  /** Já existia notificação para o mesmo ano (dedupe). */
  skipped: number;
};

function firstName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return "aluno";
  return t.split(/\s+/)[0] ?? t;
}

/**
 * Envia notificação de aniversário para alunos cuja data de nascimento coincide com o dia atual
 * no calendário do Brasil (mesmo mês e dia).
 *
 * Dedupe: uma notificação por usuário por ano civil (`birthday:userId:year`).
 */
export async function runBirthdayNotificationsForToday(): Promise<BirthdayNotifyRunResult> {
  const today = getBrazilTodayDateOnly();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const year = today.getUTCFullYear();

  const rows = await prisma.$queryRaw<Array<{ userId: string; name: string }>>`
    SELECT s."userId" AS "userId", s."name" AS "name"
    FROM "Student" s
    WHERE s."deletedAt" IS NULL
      AND s."userId" IS NOT NULL
      AND EXTRACT(MONTH FROM s."birthDate")::int = ${month}
      AND EXTRACT(DAY FROM s."birthDate")::int = ${day}
  `;

  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    const fn = firstName(row.name);
    const created = await createUserNotificationIfNew({
      userId: row.userId,
      kind: UserNotificationKind.BIRTHDAY,
      title: "Feliz aniversário!",
      body: `Parabéns, ${fn}! Desejamos um dia muito especial e um ano cheio de conquistas.`,
      linkUrl: "/dashboard",
      dedupeKey: `birthday:${row.userId}:${year}`,
    });
    if (created) sent += 1;
    else skipped += 1;
  }

  return { sent, skipped };
}
