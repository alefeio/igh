import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "./provider";
import { recalculateSmsCampaignTotals } from "./campaign";

const BATCH_SIZE = 20;

export interface ProcessBatchResult {
  campaignId: string;
  processed: number;
  remaining: number;
  done: boolean;
}

/**
 * Processa um lote de destinatários PENDING da campanha (serverless-safe).
 * Atualiza status de cada um (SENT, DELIVERED, FAILED, INVALID_PHONE) e, ao finalizar, recalcula totais.
 */
export async function processSmsCampaignBatch(
  campaignId: string,
  batchSize: number = BATCH_SIZE
): Promise<ProcessBatchResult> {
  const campaign = await prisma.smsCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true },
  });
  if (!campaign) {
    return { campaignId, processed: 0, remaining: 0, done: true };
  }
  if (campaign.status !== "PROCESSING" && campaign.status !== "SCHEDULED") {
    return { campaignId, processed: 0, remaining: 0, done: true };
  }

  if (campaign.status === "SCHEDULED") {
    await prisma.smsCampaign.update({
      where: { id: campaignId },
      data: { status: "PROCESSING", startedAt: new Date() },
    });
  }

  const pending = await prisma.smsCampaignRecipient.findMany({
    where: { campaignId, status: "PENDING" },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });

  const provider = getSmsProvider();

  for (const rec of pending) {
    const result = await provider.send(rec.phoneNormalized, rec.renderedMessage);
    await prisma.smsCampaignRecipient.update({
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

  const remaining = await prisma.smsCampaignRecipient.count({
    where: { campaignId, status: "PENDING" },
  });

  if (remaining === 0) {
    await recalculateSmsCampaignTotals(campaignId);
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
export async function startDueScheduledCampaigns(): Promise<string[]> {
  const now = new Date();
  const updated = await prisma.smsCampaign.updateMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    data: { status: "PROCESSING", startedAt: now },
  });
  if (updated.count === 0) return [];
  const list = await prisma.smsCampaign.findMany({
    where: { status: "PROCESSING", startedAt: now },
    select: { id: true },
  });
  return list.map((c) => c.id);
}
