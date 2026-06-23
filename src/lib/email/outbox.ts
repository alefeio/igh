import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getResendDailyEmailRemaining } from "@/lib/email/daily-quota";

const MAX_ATTEMPTS = 5;

export type EnqueueEmailParams = {
  to: string;
  subject: string;
  html: string;
  emailType: string;
  entityType?: string;
  entityId?: string;
  performedByUserId?: string | null;
};

export async function enqueueEmail(params: EnqueueEmailParams): Promise<{ id: string }> {
  const row = await prisma.emailOutbox.create({
    data: {
      to: params.to,
      subject: params.subject,
      html: params.html,
      emailType: params.emailType,
      entityType: params.entityType,
      entityId: params.entityId,
      performedByUserId: params.performedByUserId ?? undefined,
    },
    select: { id: true },
  });
  return row;
}

export async function hasEmailPendingOrSent(params: {
  emailType: string;
  entityType: string;
  entityId: string;
}): Promise<boolean> {
  const [sent, queued] = await Promise.all([
    prisma.sentEmail.findFirst({
      where: {
        emailType: params.emailType,
        entityType: params.entityType,
        entityId: params.entityId,
      },
      select: { id: true },
    }),
    prisma.emailOutbox.findFirst({
      where: {
        emailType: params.emailType,
        entityType: params.entityType,
        entityId: params.entityId,
        status: "PENDING",
      },
      select: { id: true },
    }),
  ]);
  return !!(sent || queued);
}

/** Evita duplicar aviso de suspensão na mesma ocorrência; permite novo e-mail após reativação. */
export async function hasEnrollmentSuspensionEmailPendingOrSentSince(
  enrollmentId: string,
  since: Date
): Promise<boolean> {
  const [sent, queued] = await Promise.all([
    prisma.sentEmail.findFirst({
      where: {
        emailType: "enrollment_suspended_attendance",
        entityType: "Enrollment",
        entityId: enrollmentId,
        sentAt: { gte: since },
      },
      select: { id: true },
    }),
    prisma.emailOutbox.findFirst({
      where: {
        emailType: "enrollment_suspended_attendance",
        entityType: "Enrollment",
        entityId: enrollmentId,
        status: "PENDING",
        createdAt: { gte: since },
      },
      select: { id: true },
    }),
  ]);
  return !!(sent || queued);
}

export type ProcessEmailOutboxResult = {
  processed: number;
  sent: number;
  failed: number;
  remaining: number;
  quotaRemaining: number;
};

/**
 * Processa a fila transacional respeitando a cota diária restante.
 * Prioridade sobre campanhas de e-mail em massa.
 */
export async function processEmailOutboxBatch(batchSize = 25): Promise<ProcessEmailOutboxResult> {
  let quotaRemaining = await getResendDailyEmailRemaining();
  if (quotaRemaining <= 0) {
    const remaining = await prisma.emailOutbox.count({ where: { status: "PENDING" } });
    return { processed: 0, sent: 0, failed: 0, remaining, quotaRemaining: 0 };
  }

  const take = Math.min(batchSize, quotaRemaining);
  const priorityEmailTypes = ["enrollment_suspended_attendance"];

  const [priorityPending, regularPending] = await Promise.all([
    prisma.emailOutbox.findMany({
      where: { status: "PENDING", emailType: { in: priorityEmailTypes } },
      orderBy: { createdAt: "asc" },
      take,
    }),
    prisma.emailOutbox.findMany({
      where: { status: "PENDING", emailType: { notIn: priorityEmailTypes } },
      orderBy: { createdAt: "asc" },
      take,
    }),
  ]);

  const pending = [...priorityPending, ...regularPending].slice(0, take);

  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    if (quotaRemaining <= 0) break;

    const result = await sendEmail({
      to: row.to,
      subject: row.subject,
      html: row.html,
    });

    if (result.success && result.messageId && result.messageId !== "dev-skip") {
      await prisma.$transaction([
        prisma.sentEmail.create({
          data: {
            to: row.to,
            subject: row.subject,
            messageId: result.messageId,
            emailType: row.emailType,
            entityType: row.entityType ?? undefined,
            entityId: row.entityId ?? undefined,
            performedByUserId: row.performedByUserId ?? undefined,
          },
        }),
        prisma.emailOutbox.update({
          where: { id: row.id },
          data: { status: "SENT", sentAt: new Date(), attempts: row.attempts + 1 },
        }),
      ]);
      sent += 1;
      quotaRemaining -= 1;
      continue;
    }

    const attempts = row.attempts + 1;
    const isFinalFailure = attempts >= MAX_ATTEMPTS;
    await prisma.emailOutbox.update({
      where: { id: row.id },
      data: {
        attempts,
        errorMessage: result.error ?? "Falha ao enviar e-mail.",
        status: isFinalFailure ? "FAILED" : "PENDING",
      },
    });
    if (isFinalFailure) failed += 1;
  }

  const remaining = await prisma.emailOutbox.count({ where: { status: "PENDING" } });
  return {
    processed: pending.length,
    sent,
    failed,
    remaining,
    quotaRemaining,
  };
}
