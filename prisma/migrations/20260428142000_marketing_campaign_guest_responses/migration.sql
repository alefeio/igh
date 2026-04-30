-- CreateTable
CREATE TABLE "MarketingCampaignGuestResponse" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingCampaignGuestResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaignGuestResponsePublicLike" (
    "id" TEXT NOT NULL,
    "guestResponseId" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingCampaignGuestResponsePublicLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingCampaignGuestResponse_campaignId_idx" ON "MarketingCampaignGuestResponse"("campaignId");

-- CreateIndex
CREATE INDEX "MarketingCampaignGuestResponse_createdAt_idx" ON "MarketingCampaignGuestResponse"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaignGuestResponsePublicLike_guestResponseId_anonId_key" ON "MarketingCampaignGuestResponsePublicLike"("guestResponseId", "anonId");

-- CreateIndex
CREATE INDEX "MarketingCampaignGuestResponsePublicLike_guestResponseId_idx" ON "MarketingCampaignGuestResponsePublicLike"("guestResponseId");

-- CreateIndex
CREATE INDEX "MarketingCampaignGuestResponsePublicLike_anonId_idx" ON "MarketingCampaignGuestResponsePublicLike"("anonId");

-- AddForeignKey
ALTER TABLE "MarketingCampaignGuestResponse" ADD CONSTRAINT "MarketingCampaignGuestResponse_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaignGuestResponsePublicLike" ADD CONSTRAINT "MarketingCampaignGuestResponsePublicLike_guestResponseId_fkey" FOREIGN KEY ("guestResponseId") REFERENCES "MarketingCampaignGuestResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

