-- CreateEnum
CREATE TYPE "SmsCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'SENT', 'PARTIALLY_SENT', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SmsRecipientStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'INVALID_PHONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "SmsAudienceType" AS ENUM ('ALL_STUDENTS', 'CLASS_GROUP', 'STUDENTS_INCOMPLETE', 'STUDENTS_COMPLETE', 'STUDENTS_ACTIVE', 'STUDENTS_INACTIVE', 'BY_COURSE', 'TEACHERS', 'ADMINS', 'ALL_ACTIVE_USERS');

-- CreateTable
CREATE TABLE "SmsCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "audienceType" "SmsAudienceType" NOT NULL,
    "audienceFilters" JSONB,
    "templateId" TEXT,
    "messageContent" TEXT,
    "messageCharCount" INTEGER,
    "status" "SmsCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "totalFound" INTEGER NOT NULL DEFAULT 0,
    "totalValid" INTEGER NOT NULL DEFAULT 0,
    "totalMissingPhone" INTEGER NOT NULL DEFAULT 0,
    "totalInvalidPhone" INTEGER NOT NULL DEFAULT 0,
    "totalDuplicatesRemoved" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "canceledById" TEXT,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientNameSnapshot" TEXT NOT NULL,
    "phoneSnapshot" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "renderedMessage" TEXT NOT NULL,
    "providerName" TEXT,
    "providerMessageId" TEXT,
    "providerResponse" JSONB,
    "status" "SmsRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryHint" TEXT,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsCampaign_status_idx" ON "SmsCampaign"("status");

-- CreateIndex
CREATE INDEX "SmsCampaign_createdById_idx" ON "SmsCampaign"("createdById");

-- CreateIndex
CREATE INDEX "SmsCampaign_scheduledAt_idx" ON "SmsCampaign"("scheduledAt");

-- CreateIndex
CREATE INDEX "SmsCampaignRecipient_campaignId_idx" ON "SmsCampaignRecipient"("campaignId");

-- CreateIndex
CREATE INDEX "SmsCampaignRecipient_campaignId_status_idx" ON "SmsCampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX "SmsTemplate_active_idx" ON "SmsTemplate"("active");

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_canceledById_fkey" FOREIGN KEY ("canceledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SmsTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaignRecipient" ADD CONSTRAINT "SmsCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmsCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsTemplate" ADD CONSTRAINT "SmsTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
