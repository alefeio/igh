-- CreateTable
CREATE TABLE "MarketingCampaignResponseLike" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingCampaignResponseLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaignResponseLike_responseId_userId_key" ON "MarketingCampaignResponseLike"("responseId", "userId");

-- CreateIndex
CREATE INDEX "MarketingCampaignResponseLike_responseId_idx" ON "MarketingCampaignResponseLike"("responseId");

-- CreateIndex
CREATE INDEX "MarketingCampaignResponseLike_userId_idx" ON "MarketingCampaignResponseLike"("userId");

-- AddForeignKey
ALTER TABLE "MarketingCampaignResponseLike" ADD CONSTRAINT "MarketingCampaignResponseLike_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "MarketingCampaignResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaignResponseLike" ADD CONSTRAINT "MarketingCampaignResponseLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
