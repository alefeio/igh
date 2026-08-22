import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getResendDailyEmailRemaining } from "@/lib/email/daily-quota";
import { checkOutboxRowEligibility } from "@/lib/email/transactional-eligibility-db";

const MAX_ATTEMPTS = 5;

/** Tipos do e-mail de cadastro na turma (uma vez por matrícula). */
export const ENROLLMENT_WELCOME_EMAIL_TYPES = [
  "welcome_student",
  "welcome_student_waitlist",
] as const;

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

/** Já houve envio ou fila de boas-vindas para esta matrícula. */
export async function hasEnrollmentWelcomeEmailPendingOrSent(
  enrollmentId: string,
): Promise<boolean> {
  const ids = await findEnrollmentIdsWithWelcomeEmail([enrollmentId]);
  return ids.has(enrollmentId);
}

/** IDs de matrícula que já tiveram e-mail de cadastro enviado ou enfileirado. */
export async function findEnrollmentIdsWithWelcomeEmail(
  enrollmentIds: string[],
): Promise<Set<string>> {
  if (enrollmentIds.length === 0) return new Set();

  const types = [...ENROLLMENT_WELCOME_EMAIL_TYPES];
  const [sent, queued] = await Promise.all([
    prisma.sentEmail.findMany({
      where: {
        entityType: "Enrollment",
        entityId: { in: enrollmentIds },
        emailType: { in: types },
      },
      select: { entityId: true },
    }),
    prisma.emailOutbox.findMany({
      where: {
        entityType: "Enrollment",
        entityId: { in: enrollmentIds },
        emailType: { in: types },
        status: { in: ["PENDING", "SENT"] },
      },
      select: { entityId: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const row of sent) {
    if (row.entityId) ids.add(row.entityId);
  }
  for (const row of queued) {
    if (row.entityId) ids.add(row.entityId);
  }
  return ids;
}
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
  const priorityEmailTypes = ["enrollment_suspended_attendance", "enrollment_cancelled"];

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
  const welcomeHandledThisBatch = new Set<string>();

  for (const row of pending) {
    if (quotaRemaining <= 0) break;

    const isWelcome =
      row.entityType === "Enrollment" &&
      row.entityId &&
      (ENROLLMENT_WELCOME_EMAIL_TYPES as readonly string[]).includes(row.emailType);

    if (isWelcome && row.entityId) {
      const alreadySent = welcomeHandledThisBatch.has(row.entityId)
        ? true
        : Boolean(
            await prisma.sentEmail.findFirst({
              where: {
                entityType: "Enrollment",
                entityId: row.entityId,
                emailType: { in: [...ENROLLMENT_WELCOME_EMAIL_TYPES] },
              },
              select: { id: true },
            }),
          );
      if (alreadySent) {
        welcomeHandledThisBatch.add(row.entityId);
        await prisma.emailOutbox.update({
          where: { id: row.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            attempts: row.attempts + 1,
            errorMessage: "skipped_duplicate",
          },
        });
        continue;
      }
    }

    const eligibility = await checkOutboxRowEligibility({
      emailType: row.emailType,
      entityType: row.entityType,
      entityId: row.entityId,
      to: row.to,
    });
    if (!eligibility.eligible) {
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          attempts: row.attempts + 1,
          errorMessage: `skipped_ineligible:${eligibility.reason}`,
        },
      });
      continue;
    }

    const result = await sendEmail({
      to: row.to,
      subject: row.subject,
      html: row.html,
    });

    if (result.success && result.messageId !== "dev-skip") {
      await prisma.$transaction([
        prisma.sentEmail.create({
          data: {
            to: row.to,
            subject: row.subject,
            messageId: result.messageId ?? undefined,
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
      if (isWelcome && row.entityId) welcomeHandledThisBatch.add(row.entityId);
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
