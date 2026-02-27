import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "./index";
import type { SendEmailParams, SendEmailResult } from "./index";

export interface SendEmailAndRecordParams extends SendEmailParams {
  emailType: string;
  entityType?: string;
  entityId?: string;
  performedByUserId?: string | null;
}

/**
 * Envia o e-mail e grava em SentEmail somente após confirmação de envio (success).
 * Se o envio falhar, nenhum registro é criado.
 */
export async function sendEmailAndRecord(
  params: SendEmailAndRecordParams
): Promise<SendEmailResult> {
  const { emailType, entityType, entityId, performedByUserId, ...emailParams } = params;
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
