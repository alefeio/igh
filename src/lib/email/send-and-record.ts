import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "./index";
import type { SendEmailParams, SendEmailResult } from "./index";
import { hasResendDailyEmailQuota } from "./daily-quota";
import { enqueueEmail } from "./outbox";

export interface SendEmailAndRecordParams extends SendEmailParams {
  emailType: string;
  entityType?: string;
  entityId?: string;
  performedByUserId?: string | null;
  /** Se true (padrão), enfileira quando a cota diária do Resend estiver esgotada. */
  queueIfDailyQuotaExceeded?: boolean;
}

export interface SendEmailAndRecordResult extends SendEmailResult {
  queued?: boolean;
  skippedDuplicate?: boolean;
}

/**
 * Envia o e-mail e grava em SentEmail somente após confirmação de envio (success).
 * Se a cota diária estiver esgotada, enfileira em EmailOutbox para envio posterior (cron).
 */
export async function sendEmailAndRecord(
  params: SendEmailAndRecordParams
): Promise<SendEmailAndRecordResult> {
  const {
    emailType,
    entityType,
    entityId,
    performedByUserId,
    queueIfDailyQuotaExceeded = true,
    ...emailParams
  } = params;

  if (queueIfDailyQuotaExceeded) {
    const hasQuota = await hasResendDailyEmailQuota(1);
    if (!hasQuota) {
      await enqueueEmail({
        to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
        subject: params.subject,
        html: params.html,
        emailType,
        entityType,
        entityId,
        performedByUserId,
      });
      return { success: true, queued: true };
    }
  }

  const result = await sendEmail(emailParams);

  if (!result.success) {
    return result;
  }
  if (!result.messageId || result.messageId === "dev-skip") {
    return result;
  }

  const toList = Array.isArray(params.to) ? params.to : [params.to];
  const toStr = toList.join(", ");

  await prisma.sentEmail.create({
    data: {
      to: toStr,
      subject: params.subject,
      messageId: result.messageId ?? undefined,
      emailType,
      entityType: entityType ?? undefined,
      entityId: entityId ?? undefined,
      performedByUserId: performedByUserId ?? undefined,
    },
  });

  return result;
}
