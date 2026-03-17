import { prisma } from "@/lib/prisma";
import type { EmailRecipientStatus } from "@/generated/prisma/client";
import { updateEmailCampaignCountsOnly } from "./campaign";

/**
 * Payload típico do webhook Resend (email events).
 * @see https://resend.com/docs/webhooks/event-types
 */
export interface ResendWebhookPayload {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const EVENT_TO_STATUS: Record<
  string,
  { status: EmailRecipientStatus; dateField: "deliveredAt" | "openedAt" | "clickedAt" | "bouncedAt" | "complainedAt" }
> = {
  "email.delivered": { status: "DELIVERED", dateField: "deliveredAt" },
  "email.opened": { status: "OPENED", dateField: "openedAt" },
  "email.clicked": { status: "CLICKED", dateField: "clickedAt" },
  "email.bounced": { status: "BOUNCED", dateField: "bouncedAt" },
  "email.complained": { status: "COMPLAINED", dateField: "complainedAt" },
  "email.failed": { status: "FAILED", dateField: "deliveredAt" }, // dateField ignorado para FAILED
};

/**
 * Processa um evento de webhook do Resend e atualiza o recipient correspondente (por providerMessageId).
 * Retorna true se o evento foi aplicado a algum registro.
 */
export async function handleResendWebhookEvent(
  payload: ResendWebhookPayload
): Promise<boolean> {
  const eventType = payload?.type;
  if (!eventType || typeof eventType !== "string") return false;

  const mapping = EVENT_TO_STATUS[eventType];
  if (!mapping) return false;

  const messageId =
    payload?.data?.email_id ?? payload?.data?.id ?? null;
  if (!messageId || typeof messageId !== "string") return false;

  const recipient = await prisma.emailCampaignRecipient.findFirst({
    where: { providerMessageId: messageId },
    select: { id: true, campaignId: true },
  });
  if (!recipient) return false;

  const now = new Date();
  const updateData: Record<string, unknown> = {
    status: mapping.status,
    updatedAt: now,
  };
  if (mapping.dateField && mapping.status !== "FAILED")
    updateData[mapping.dateField] = now;

  await prisma.emailCampaignRecipient.update({
    where: { id: recipient.id },
    data: updateData as Record<string, unknown>,
  });

  await updateEmailCampaignCountsOnly(recipient.campaignId);

  return true;
}
