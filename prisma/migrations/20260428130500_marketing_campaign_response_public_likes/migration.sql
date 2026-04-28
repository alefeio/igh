-- CreateTable
CREATE TABLE "MarketingCampaignResponsePublicLike" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingCampaignResponsePublicLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaignResponsePublicLike_responseId_anonId_key" ON "MarketingCampaignResponsePublicLike"("responseId", "anonId");

-- CreateIndex
CREATE INDEX "MarketingCampaignResponsePublicLike_responseId_idx" ON "MarketingCampaignResponsePublicLike"("responseId");

-- CreateIndex
CREATE INDEX "MarketingCampaignResponsePublicLike_anonId_idx" ON "MarketingCampaignResponsePublicLike"("anonId");

-- AddForeignKey
ALTER TABLE "MarketingCampaignResponsePublicLike" ADD CONSTRAINT "MarketingCampaignResponsePublicLike_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "MarketingCampaignResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

