import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type {
  EmailAudienceType,
  EmailCampaignStatus,
  EmailRecipientStatus,
} from "@/generated/prisma/client";
import { resolveEmailAudience } from "./audience";
import type { EmailAudienceFilters } from "./audience";
import { buildEligibleEmailRecipients } from "./eligible";
import { previewEmailCampaign } from "./preview";

const DRAFT: EmailCampaignStatus = "DRAFT";
const SCHEDULED: EmailCampaignStatus = "SCHEDULED";
const PROCESSING: EmailCampaignStatus = "PROCESSING";
const CANCELED: EmailCampaignStatus = "CANCELED";
const PENDING: EmailRecipientStatus = "PENDING";

export interface CreateEmailCampaignInput {
  name: string;
  description?: string | null;
  audienceType: EmailAudienceType;
  audienceFilters?: EmailAudienceFilters | null;
  templateId?: string | null;
  subject?: string | null;
  htmlContent?: string | null;
  textContent?: string | null;
  scheduledAt?: Date | null;
  createdById: string;
}

export interface UpdateEmailCampaignInput {
  name?: string;
  description?: string | null;
  audienceType?: EmailAudienceType;
  audienceFilters?: EmailAudienceFilters | null;
  templateId?: string | null;
  subject?: string | null;
  htmlContent?: string | null;
  textContent?: string | null;
  scheduledAt?: Date | null;
}

export async function createEmailCampaign(input: CreateEmailCampaignInput) {
  return prisma.emailCampaign.create({
    data: {
      name: input.name,
      description: input.description ?? undefined,
      audienceType: input.audienceType,
      audienceFilters: (input.audienceFilters ?? undefined) as Prisma.InputJsonValue | undefined,
      templateId: input.templateId ?? undefined,
      subject: input.subject ?? undefined,
      htmlContent: input.htmlContent ?? undefined,
      textContent: input.textContent ?? undefined,
      status: DRAFT,
      scheduledAt: input.scheduledAt ?? undefined,
      createdById: input.createdById,
    },
  });
}

export async function updateEmailCampaign(
  id: string,
  input: UpdateEmailCampaignInput
) {
  const existing = await prisma.emailCampaign.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) return null;
  if (existing.status !== DRAFT) return null;

  return prisma.emailCampaign.update({
    where: { id },
    data: {
      ...(input.name != null && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.audienceType != null && { audienceType: input.audienceType }),
      ...(input.audienceFilters !== undefined && {
        audienceFilters: input.audienceFilters as Prisma.InputJsonValue,
      }),
      ...(input.templateId !== undefined && { templateId: input.templateId }),
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.htmlContent !== undefined && { htmlContent: input.htmlContent }),
      ...(input.textContent !== undefined && { textContent: input.textContent }),
      ...(input.scheduledAt !== undefined && { scheduledAt: input.scheduledAt }),
    },
  });
}

/** Retorna prévia (totais) sem persistir. */
export async function getEmailCampaignPreview(
  audienceType: EmailAudienceType,
  audienceFilters: EmailAudienceFilters | null
) {
  const recipients = await resolveEmailAudience(audienceType, audienceFilters);
  return previewEmailCampaign(recipients);
}

/**
 * Confirma a campanha: congela destinatários elegíveis e altera status para SCHEDULED (ou PROCESSING se envio imediato).
 * subject, htmlContent e textContent devem ser o conteúdo final (já resolvido de template se for o caso).
 */
export async function confirmEmailCampaign(
  campaignId: string,
  subject: string,
  htmlContent: string | null,
  textContent: string | null,
  confirmedById: string,
  sendImmediately: boolean
) {
  const campaign = await prisma.emailCampaign.findUnique({
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

  const recipients = await resolveEmailAudience(
    campaign.audienceType,
    campaign.audienceFilters as EmailAudienceFilters | null
  );
  const preview = previewEmailCampaign(recipients);
  const eligible = await buildEligibleEmailRecipients(
    recipients,
    subject,
    htmlContent,
    textContent
  );

  await prisma.$transaction(async (tx) => {
    await tx.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: SCHEDULED,
        subject,
        htmlContent: htmlContent ?? undefined,
        textContent: textContent ?? undefined,
        totalFound: preview.totalFound,
        totalValid: preview.totalEligible,
        totalMissingEmail: preview.totalMissingEmail,
        totalInvalidEmail: preview.totalInvalidEmail,
        totalDuplicatesRemoved: preview.totalDuplicatesRemoved,
        confirmedById,
      },
    });
    await tx.emailCampaignRecipient.createMany({
      data: eligible.map((e) => ({
        campaignId,
        recipientType: e.recipientType,
        recipientId: e.recipientId,
        recipientNameSnapshot: e.recipientNameSnapshot,
        emailSnapshot: e.emailSnapshot,
        emailNormalized: e.emailNormalized,
        renderedSubject: e.renderedSubject,
        renderedHtmlContent: e.renderedHtmlContent ?? undefined,
        renderedTextContent: e.renderedTextContent ?? undefined,
        status: PENDING,
      })),
    });
  });

  if (sendImmediately) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: PROCESSING,
        startedAt: new Date(),
        dispatchCount: { increment: 1 },
      },
    });
  }

  return prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: { recipients: true },
  });
}

export async function cancelEmailCampaign(
  campaignId: string,
  canceledById: string
) {
  const campaign = await prisma.emailCampaign.findUnique({
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

  return prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: CANCELED,
      canceledById,
      canceledAt: new Date(),
    },
  });
}

export async function duplicateEmailCampaign(
  campaignId: string,
  createdById: string
) {
  const source = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: {
      name: true,
      description: true,
      audienceType: true,
      audienceFilters: true,
      templateId: true,
      subject: true,
      htmlContent: true,
      textContent: true,
    },
  });
  if (!source) return null;

  return createEmailCampaign({
    name: `${source.name} (cópia)`,
    description: source.description,
    audienceType: source.audienceType,
    audienceFilters: source.audienceFilters as EmailAudienceFilters | null,
    templateId: source.templateId,
    subject: source.subject,
    htmlContent: source.htmlContent,
    textContent: source.textContent,
    createdById,
  });
}

const DEFAULT_REQUEUE_FAILURE_STATUSES: EmailRecipientStatus[] = [
  "FAILED",
  "BOUNCED",
  "COMPLAINED",
];

/**
 * Reenvia e-mails da campanha para destinatários em estados de falha.
 * Recoloca os status informados (padrão: FAILED/BOUNCED/COMPLAINED) em PENDING, limpando campos de provider/erro.
 * Não reenfileira INVALID_EMAIL.
 * Se nenhuma linha for atualizada, a campanha não é alterada (sem novo disparo).
 */
export async function requeueFailedEmailCampaignRecipients(
  campaignId: string,
  options?: { statuses?: EmailRecipientStatus[] }
) {
  const failureStatuses =
    options?.statuses && options.statuses.length > 0
      ? options.statuses
      : DEFAULT_REQUEUE_FAILURE_STATUSES;

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true },
  });
  if (!campaign) return null;
  if (campaign.status === CANCELED) return null;

  return prisma.$transaction(async (tx) => {
    const update = await tx.emailCampaignRecipient.updateMany({
      where: {
        campaignId,
        status: { in: failureStatuses },
      },
      data: {
        status: PENDING,
        providerName: null,
        providerMessageId: null,
        providerResponse: Prisma.DbNull,
        errorMessage: null,
        sentAt: null,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        bouncedAt: null,
        complainedAt: null,
      },
    });
    if (update.count === 0) {
      return { updatedCount: 0 };
    }
    await tx.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: PROCESSING,
        startedAt: new Date(),
        finishedAt: null,
        dispatchCount: { increment: 1 },
      },
    });
    return { updatedCount: update.count };
  });
}

/**
 * Reenvia um destinatário específico da campanha.
 * Recoloca o recipient em PENDING e limpa campos de provider/erro.
 * Não permite reenviar INVALID_EMAIL.
 */
export async function requeueEmailCampaignRecipient(
  campaignId: string,
  recipientId: string
) {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true },
  });
  if (!campaign) return null;
  if (campaign.status === CANCELED) return null;

  const recipient = await prisma.emailCampaignRecipient.findFirst({
    where: { id: recipientId, campaignId },
    select: { id: true, status: true },
  });
  if (!recipient) return null;
  if (recipient.status === "INVALID_EMAIL") return { blocked: true as const };

  await prisma.$transaction(async (tx) => {
    await tx.emailCampaignRecipient.update({
      where: { id: recipientId },
      data: {
        status: PENDING,
        providerName: null,
        providerMessageId: null,
        providerResponse: Prisma.DbNull,
        errorMessage: null,
        sentAt: null,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        bouncedAt: null,
        complainedAt: null,
        attempts: 0,
      },
    });
    await tx.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: PROCESSING,
        startedAt: new Date(),
        finishedAt: null,
      },
    });
  });

  return { blocked: false as const };
}

export async function listEmailCampaigns(opts: {
  page?: number;
  pageSize?: number;
  status?: EmailCampaignStatus;
  search?: string;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.EmailCampaignWhereInput = {};
  if (opts.status) where.status = opts.status;
  if (opts.search?.trim()) {
    where.name = { contains: opts.search.trim(), mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    prisma.emailCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.emailCampaign.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getEmailCampaignDetails(id: string) {
  return prisma.emailCampaign.findUnique({
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

export async function recalculateEmailCampaignTotals(campaignId: string) {
  const counts = await prisma.emailCampaignRecipient.groupBy({
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
    .filter((c) =>
      ["FAILED", "INVALID_EMAIL", "BOUNCED", "COMPLAINED"].includes(c.status)
    )
    .reduce((s, c) => s + c._count.id, 0);
  const totalOpened = counts
    .filter((c) => c.status === "OPENED")
    .reduce((s, c) => s + c._count.id, 0);
  const totalClicked = counts
    .filter((c) => c.status === "CLICKED")
    .reduce((s, c) => s + c._count.id, 0);

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { totalValid: true },
  });
  const totalValid = campaign?.totalValid ?? 0;

  let status: EmailCampaignStatus = "SENT";
  if (totalFailed >= totalValid) status = "FAILED";
  else if (totalSent < totalValid) status = "PARTIALLY_SENT";

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      totalSent,
      totalDelivered,
      totalFailed,
      totalOpened,
      totalClicked,
      status,
      finishedAt: new Date(),
    },
  });
  return prisma.emailCampaign.findUnique({ where: { id: campaignId } });
}

/**
 * Atualiza apenas os totais da campanha a partir dos recipients (para webhooks).
 * Não altera status nem finishedAt.
 */
export async function updateEmailCampaignCountsOnly(campaignId: string) {
  const counts = await prisma.emailCampaignRecipient.groupBy({
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
    .filter((c) =>
      ["FAILED", "INVALID_EMAIL", "BOUNCED", "COMPLAINED"].includes(c.status)
    )
    .reduce((s, c) => s + c._count.id, 0);
  const totalOpened = counts
    .filter((c) => c.status === "OPENED")
    .reduce((s, c) => s + c._count.id, 0);
  const totalClicked = counts
    .filter((c) => c.status === "CLICKED")
    .reduce((s, c) => s + c._count.id, 0);

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      totalSent,
      totalDelivered,
      totalFailed,
      totalOpened,
      totalClicked,
    },
  });
}
