import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type {
  SmsAudienceType,
  SmsCampaignStatus,
  SmsRecipientStatus,
} from "@/generated/prisma/client";
import { resolveSmsAudience } from "./audience";
import type { AudienceFilters } from "./audience";
import { buildEligibleRecipients } from "./eligible";
import { previewSmsCampaign } from "./preview";

const DRAFT: SmsCampaignStatus = "DRAFT";
const SCHEDULED: SmsCampaignStatus = "SCHEDULED";
const PROCESSING: SmsCampaignStatus = "PROCESSING";
const CANCELED: SmsCampaignStatus = "CANCELED";
const PENDING: SmsRecipientStatus = "PENDING";

export interface CreateSmsCampaignInput {
  name: string;
  description?: string | null;
  audienceType: SmsAudienceType;
  audienceFilters?: AudienceFilters | null;
  templateId?: string | null;
  messageContent?: string | null;
  scheduledAt?: Date | null;
  createdById: string;
}

export interface UpdateSmsCampaignInput {
  name?: string;
  description?: string | null;
  audienceType?: SmsAudienceType;
  audienceFilters?: AudienceFilters | null;
  templateId?: string | null;
  messageContent?: string | null;
  scheduledAt?: Date | null;
}

export async function createSmsCampaign(input: CreateSmsCampaignInput) {
  const charCount =
    input.messageContent != null ? input.messageContent.length : undefined;
  return prisma.smsCampaign.create({
    data: {
      name: input.name,
      description: input.description ?? undefined,
      audienceType: input.audienceType,
      audienceFilters: (input.audienceFilters ?? undefined) as Prisma.InputJsonValue | undefined,
      templateId: input.templateId ?? undefined,
      messageContent: input.messageContent ?? undefined,
      messageCharCount: charCount,
      status: DRAFT,
      scheduledAt: input.scheduledAt ?? undefined,
      createdById: input.createdById,
    },
  });
}

export async function updateSmsCampaign(
  id: string,
  input: UpdateSmsCampaignInput
) {
  const existing = await prisma.smsCampaign.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) return null;
  if (existing.status !== DRAFT) return null;

  const messageCharCount =
    input.messageContent != null ? input.messageContent.length : undefined;
  return prisma.smsCampaign.update({
    where: { id },
    data: {
      ...(input.name != null && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.audienceType != null && { audienceType: input.audienceType }),
      ...(input.audienceFilters !== undefined && {
        audienceFilters: input.audienceFilters as Prisma.InputJsonValue,
      }),
      ...(input.templateId !== undefined && { templateId: input.templateId }),
      ...(input.messageContent !== undefined && {
        messageContent: input.messageContent,
        messageCharCount: messageCharCount ?? undefined,
      }),
      ...(input.scheduledAt !== undefined && { scheduledAt: input.scheduledAt }),
    },
  });
}

/** Retorna prévia (totais) sem persistir. */
export async function getSmsCampaignPreview(
  audienceType: SmsAudienceType,
  audienceFilters: AudienceFilters | null
) {
  const recipients = await resolveSmsAudience(audienceType, audienceFilters);
  return previewSmsCampaign(recipients);
}

/**
 * Confirma a campanha: congela destinatários elegíveis e altera status para SCHEDULED (ou dispara processamento se imediato).
 * messageContent deve ser a mensagem final (já resolvida de template se for o caso).
 */
export async function confirmSmsCampaign(
  campaignId: string,
  messageContent: string,
  confirmedById: string,
  sendImmediately: boolean
) {
  const campaign = await prisma.smsCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      status: true,
      audienceType: true,
      audienceFilters: true,
      scheduledAt: true,
    },
  });
  if (!campaign || campaign.status !== DRAFT) return null;

  const recipients = await resolveSmsAudience(
    campaign.audienceType,
    campaign.audienceFilters as AudienceFilters | null
  );
  const preview = previewSmsCampaign(recipients);
  const eligible = buildEligibleRecipients(recipients, messageContent);

  await prisma.$transaction(async (tx) => {
    await tx.smsCampaign.update({
      where: { id: campaignId },
      data: {
        status: SCHEDULED,
        messageContent,
        messageCharCount: messageContent.length,
        totalFound: preview.totalFound,
        totalValid: preview.totalEligible,
        totalMissingPhone: preview.totalMissingPhone,
        totalInvalidPhone: preview.totalInvalidPhone,
        totalDuplicatesRemoved: preview.totalDuplicatesRemoved,
        confirmedById,
      },
    });
    await tx.smsCampaignRecipient.createMany({
      data: eligible.map((e) => ({
        campaignId,
        recipientType: e.recipientType,
        recipientId: e.recipientId,
        recipientNameSnapshot: e.recipientNameSnapshot,
        phoneSnapshot: e.phoneSnapshot,
        phoneNormalized: e.phoneNormalized,
        renderedMessage: e.renderedMessage,
        status: PENDING,
      })),
    });
  });

  if (sendImmediately) {
    await prisma.smsCampaign.update({
      where: { id: campaignId },
      data: { status: PROCESSING, startedAt: new Date() },
    });
  }

  return prisma.smsCampaign.findUnique({
    where: { id: campaignId },
    include: { recipients: true },
  });
}

export async function cancelSmsCampaign(campaignId: string, canceledById: string) {
  const campaign = await prisma.smsCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true, scheduledAt: true },
  });
  if (!campaign) return null;
  if (campaign.status !== DRAFT && campaign.status !== SCHEDULED) return null;
  if (
    campaign.status === SCHEDULED &&
    campaign.scheduledAt &&
    campaign.scheduledAt <= new Date()
  ) {
    return null;
  }

  return prisma.smsCampaign.update({
    where: { id: campaignId },
    data: {
      status: CANCELED,
      canceledById,
      canceledAt: new Date(),
    },
  });
}

export async function duplicateSmsCampaign(
  campaignId: string,
  createdById: string
) {
  const source = await prisma.smsCampaign.findUnique({
    where: { id: campaignId },
    select: {
      name: true,
      description: true,
      audienceType: true,
      audienceFilters: true,
      templateId: true,
      messageContent: true,
      messageCharCount: true,
    },
  });
  if (!source) return null;

  return createSmsCampaign({
    name: `${source.name} (cópia)`,
    description: source.description,
    audienceType: source.audienceType,
    audienceFilters: source.audienceFilters as AudienceFilters | null,
    templateId: source.templateId,
    messageContent: source.messageContent,
    createdById,
  });
}

export async function listSmsCampaigns(opts: {
  page?: number;
  pageSize?: number;
  status?: SmsCampaignStatus;
  search?: string;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.SmsCampaignWhereInput = {};
  if (opts.status) where.status = opts.status;
  if (opts.search?.trim()) {
    where.name = { contains: opts.search.trim(), mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    prisma.smsCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.smsCampaign.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getSmsCampaignDetails(id: string) {
  return prisma.smsCampaign.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      confirmedBy: { select: { id: true, name: true, email: true } },
      canceledBy: { select: { id: true, name: true, email: true } },
      template: true,
      recipients: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function recalculateSmsCampaignTotals(campaignId: string) {
  const counts = await prisma.smsCampaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { id: true },
  });

  const totalSent = counts
    .filter((c) => c.status === "SENT" || c.status === "DELIVERED")
    .reduce((s, c) => s + c._count.id, 0);
  const totalDelivered = counts
    .filter((c) => c.status === "DELIVERED")
    .reduce((s, c) => s + c._count.id, 0);
  const totalFailed = counts
    .filter((c) => c.status === "FAILED" || c.status === "INVALID_PHONE")
    .reduce((s, c) => s + c._count.id, 0);

  const campaign = await prisma.smsCampaign.findUnique({
    where: { id: campaignId },
    select: { totalValid: true },
  });
  const totalValid = campaign?.totalValid ?? 0;

  let status: SmsCampaignStatus = "SENT";
  if (totalFailed >= totalValid) status = "FAILED";
  else if (totalSent < totalValid) status = "PARTIALLY_SENT";

  await prisma.smsCampaign.update({
    where: { id: campaignId },
    data: {
      totalSent,
      totalDelivered,
      totalFailed,
      status,
      finishedAt: new Date(),
    },
  });
  return prisma.smsCampaign.findUnique({ where: { id: campaignId } });
}
