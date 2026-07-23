import "server-only";

import { UserNotificationKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateBirthdayCongratulations } from "@/lib/email/templates";
import { hasEmailPendingOrSent } from "@/lib/email/outbox";
import { getBrazilTodayDateOnly } from "@/lib/teacher-gamification";
import { createUserNotificationIfNew } from "@/lib/user-notifications";

export type BirthdayNotifyRunResult = {
  /** Notificações in-app criadas (novas). */
  notificationsSent: number;
  /** Já existia notificação para o mesmo ano (dedupe). */
  notificationsSkipped: number;
  /** E-mails enviados ou enfileirados na outbox. */
  emailsSent: number;
  /** E-mail já enviado/enfileirado, sem e-mail válido ou usuário inativo. */
  emailsSkipped: number;
  /** Falha no provider ao enviar. */
  emailsFailed: number;
  /** @deprecated Use notificationsSent — mantido para compatibilidade do cron. */
  sent: number;
  /** @deprecated Use notificationsSkipped */
  skipped: number;
};

function firstName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return "você";
  return t.split(/\s+/)[0] ?? t;
}

type BirthdayRow = {
  userId: string;
  name: string;
  email: string | null;
};

/**
 * Notifica e envia e-mail de aniversário para usuários com data de nascimento
 * (cadastro de aluno vinculado) coincidente com o dia atual no calendário do Brasil.
 *
 * Cobre qualquer papel (aluno, professor, admin, coordenador etc.) desde que exista
 * `Student.birthDate` ligado a um `User` ativo.
 *
 * Dedupe in-app: `birthday:{userId}:{year}`.
 * Dedupe e-mail: SentEmail/Outbox `birthday` + entityId `{userId}:{year}`.
 */
export async function runBirthdayNotificationsForToday(): Promise<BirthdayNotifyRunResult> {
  const today = getBrazilTodayDateOnly();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const year = today.getUTCFullYear();

  // birthDate > 1970-01-01 exclui placeholder Epoch usado em contas sem data real.
  const rows = await prisma.$queryRaw<BirthdayRow[]>`
    SELECT
      s."userId" AS "userId",
      COALESCE(NULLIF(TRIM(u."name"), ''), s."name") AS "name",
      u."email" AS "email"
    FROM "Student" s
    INNER JOIN "User" u ON u.id = s."userId"
    WHERE s."deletedAt" IS NULL
      AND s."userId" IS NOT NULL
      AND u."isActive" = true
      AND s."birthDate" > DATE '1970-01-01'
      AND EXTRACT(MONTH FROM s."birthDate")::int = ${month}
      AND EXTRACT(DAY FROM s."birthDate")::int = ${day}
  `;

  let notificationsSent = 0;
  let notificationsSkipped = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;
  let emailsFailed = 0;

  for (const row of rows) {
    const displayName = row.name?.trim() || "você";
    const fn = firstName(displayName);

    const created = await createUserNotificationIfNew({
      userId: row.userId,
      kind: UserNotificationKind.BIRTHDAY,
      title: "Feliz aniversário!",
      body: `Parabéns, ${fn}! Desejamos um dia muito especial e um ano cheio de conquistas.`,
      linkUrl: "/dashboard",
      dedupeKey: `birthday:${row.userId}:${year}`,
    });
    if (created) notificationsSent += 1;
    else notificationsSkipped += 1;

    const toEmail = row.email?.trim().toLowerCase() || null;
    if (!toEmail) {
      emailsSkipped += 1;
      continue;
    }

    const entityId = `${row.userId}:${year}`;
    if (
      await hasEmailPendingOrSent({
        emailType: "birthday",
        entityType: "User",
        entityId,
      })
    ) {
      emailsSkipped += 1;
      continue;
    }

    const { subject, html } = templateBirthdayCongratulations({ name: displayName });
    const result = await sendEmailAndRecord({
      to: toEmail,
      subject,
      html,
      emailType: "birthday",
      entityType: "User",
      entityId,
    });

    if (result.success) emailsSent += 1;
    else emailsFailed += 1;
  }

  return {
    notificationsSent,
    notificationsSkipped,
    emailsSent,
    emailsSkipped,
    emailsFailed,
    sent: notificationsSent,
    skipped: notificationsSkipped,
  };
}
