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

export type BirthdayGreetingResult = {
  matchedToday: boolean;
  notificationSent: boolean;
  emailSent: boolean;
  emailSkipped: boolean;
  emailFailed: boolean;
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

/** True se mês/dia da data (UTC date-only) coincidem com o dia atual no Brasil. */
export function isBirthdayToday(birthDate: Date | null | undefined): boolean {
  if (!birthDate) return false;
  if (!(birthDate instanceof Date) || Number.isNaN(birthDate.getTime())) return false;
  if (birthDate.getTime() <= Date.UTC(1970, 0, 1)) return false;
  const today = getBrazilTodayDateOnly();
  return (
    birthDate.getUTCMonth() === today.getUTCMonth() &&
    birthDate.getUTCDate() === today.getUTCDate()
  );
}

async function sendBirthdayGreetingToRow(
  row: BirthdayRow,
  year: number
): Promise<{
  notificationSent: boolean;
  emailSent: boolean;
  emailSkipped: boolean;
  emailFailed: boolean;
}> {
  const displayName = row.name?.trim() || "você";
  const fn = firstName(displayName);

  const notificationSent = await createUserNotificationIfNew({
    userId: row.userId,
    kind: UserNotificationKind.BIRTHDAY,
    title: "Feliz aniversário!",
    body: `Parabéns, ${fn}! Desejamos um dia muito especial e um ano cheio de conquistas.`,
    linkUrl: "/dashboard",
    dedupeKey: `birthday:${row.userId}:${year}`,
  });

  const toEmail = row.email?.trim().toLowerCase() || null;
  if (!toEmail) {
    return {
      notificationSent,
      emailSent: false,
      emailSkipped: true,
      emailFailed: false,
    };
  }

  const entityId = `${row.userId}:${year}`;
  if (
    await hasEmailPendingOrSent({
      emailType: "birthday",
      entityType: "User",
      entityId,
    })
  ) {
    return {
      notificationSent,
      emailSent: false,
      emailSkipped: true,
      emailFailed: false,
    };
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

  return {
    notificationSent,
    emailSent: result.success,
    emailSkipped: false,
    emailFailed: !result.success,
  };
}

/**
 * Se o usuário (ativo) faz aniversário hoje (User.birthDate ou fallback Student.birthDate),
 * envia notificação + e-mail. Idempotente no ano civil via dedupe.
 *
 * Use após criar/atualizar conta com data de nascimento.
 */
export async function maybeSendBirthdayGreetingForUser(
  userId: string
): Promise<BirthdayGreetingResult> {
  const today = getBrazilTodayDateOnly();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const year = today.getUTCFullYear();

  const rows = await prisma.$queryRaw<BirthdayRow[]>`
    SELECT
      u.id AS "userId",
      u."name" AS "name",
      u."email" AS "email"
    FROM "User" u
    LEFT JOIN "Student" s
      ON s."userId" = u.id
      AND s."deletedAt" IS NULL
    WHERE u.id = ${userId}
      AND u."isActive" = true
      AND COALESCE(u."birthDate", s."birthDate") IS NOT NULL
      AND COALESCE(u."birthDate", s."birthDate") > DATE '1970-01-01'
      AND EXTRACT(MONTH FROM COALESCE(u."birthDate", s."birthDate"))::int = ${month}
      AND EXTRACT(DAY FROM COALESCE(u."birthDate", s."birthDate"))::int = ${day}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return {
      matchedToday: false,
      notificationSent: false,
      emailSent: false,
      emailSkipped: false,
      emailFailed: false,
    };
  }

  const result = await sendBirthdayGreetingToRow(row, year);
  return {
    matchedToday: true,
    ...result,
  };
}

/**
 * Notifica e envia e-mail de aniversário para usuários cuja data de nascimento
 * (User.birthDate ou, se ausente, Student.birthDate) coincide com o dia atual
 * no calendário do Brasil.
 *
 * Dedupe in-app: `birthday:{userId}:{year}`.
 * Dedupe e-mail: SentEmail/Outbox `birthday` + entityId `{userId}:{year}`.
 */
export async function runBirthdayNotificationsForToday(): Promise<BirthdayNotifyRunResult> {
  const today = getBrazilTodayDateOnly();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const year = today.getUTCFullYear();

  const rows = await prisma.$queryRaw<BirthdayRow[]>`
    SELECT
      u.id AS "userId",
      u."name" AS "name",
      u."email" AS "email"
    FROM "User" u
    LEFT JOIN "Student" s
      ON s."userId" = u.id
      AND s."deletedAt" IS NULL
    WHERE u."isActive" = true
      AND COALESCE(u."birthDate", s."birthDate") IS NOT NULL
      AND COALESCE(u."birthDate", s."birthDate") > DATE '1970-01-01'
      AND EXTRACT(MONTH FROM COALESCE(u."birthDate", s."birthDate"))::int = ${month}
      AND EXTRACT(DAY FROM COALESCE(u."birthDate", s."birthDate"))::int = ${day}
  `;

  let notificationsSent = 0;
  let notificationsSkipped = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;
  let emailsFailed = 0;

  for (const row of rows) {
    const result = await sendBirthdayGreetingToRow(row, year);
    if (result.notificationSent) notificationsSent += 1;
    else notificationsSkipped += 1;
    if (result.emailSent) emailsSent += 1;
    else if (result.emailFailed) emailsFailed += 1;
    else emailsSkipped += 1;
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
