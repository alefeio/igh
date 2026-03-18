import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEmailProvider } from "./provider";
import { recalculateEmailCampaignTotals } from "./campaign";

const BATCH_SIZE = 20;

export interface ProcessEmailBatchResult {
  campaignId: string;
  processed: number;
  remaining: number;
  done: boolean;
}

/**
 * Processa um lote de destinatários PENDING da campanha (serverless-safe).
 * Atualiza status de cada um (SENT, FAILED, INVALID_EMAIL) e, ao finalizar, recalcula totais.
 */
export async function processEmailCampaignBatch(
  campaignId: string,
  batchSize: number = BATCH_SIZE
): Promise<ProcessEmailBatchResult> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true },
  });
  if (!campaign) {
    return { campaignId, processed: 0, remaining: 0, done: true };
  }
  if (
    campaign.status !== "PROCESSING" &&
    campaign.status !== "SCHEDULED"
  ) {
    return { campaignId, processed: 0, remaining: 0, done: true };
  }

  if (campaign.status === "SCHEDULED") {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        dispatchCount: { increment: 1 },
      },
    });
  }

  const pending = await prisma.emailCampaignRecipient.findMany({
    where: { campaignId, status: "PENDING" },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });

  const provider = getEmailProvider();

  for (const rec of pending) {
    const result = await provider.send({
      to: rec.emailNormalized,
      subject: rec.renderedSubject,
      html: rec.renderedHtmlContent,
      text: rec.renderedTextContent,
    });
    await prisma.emailCampaignRecipient.update({
      where: { id: rec.id },
      data: {
        status: result.success ? "SENT" : "FAILED",
        providerName: provider.name,
        providerMessageId: result.providerMessageId ?? undefined,
        providerResponse: (result.providerResponse ?? undefined) as Prisma.InputJsonValue | undefined,
        errorMessage: result.errorMessage ?? undefined,
        attempts: rec.attempts + 1,
        sentAt: result.success ? new Date() : undefined,
      },
    });
  }

  const remaining = await prisma.emailCampaignRecipient.count({
    where: { campaignId, status: "PENDING" },
  });

  if (remaining === 0) {
    await recalculateEmailCampaignTotals(campaignId);
  }

  return {
    campaignId,
    processed: pending.length,
    remaining,
    done: remaining === 0,
  };
}

/**
 * Marca campanhas SCHEDULED com scheduledAt <= now como PROCESSING (para cron acionar processamento).
 * Retorna IDs que passaram a PROCESSING.
 */
export async function startDueScheduledEmailCampaigns(): Promise<string[]> {
  const now = new Date();
  await prisma.emailCampaign.updateMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    data: {
      status: "PROCESSING",
      startedAt: now,
      dispatchCount: { increment: 1 },
    },
  });
  const list = await prisma.emailCampaign.findMany({
    where: { status: "PROCESSING", startedAt: now },
    select: { id: true },
  });
  return list.map((c) => c.id);
}
