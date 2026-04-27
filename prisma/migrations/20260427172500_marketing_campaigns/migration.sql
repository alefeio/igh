-- Marketing campaigns (Day of Mothers etc.)

CREATE TABLE IF NOT EXISTS "public"."MarketingCampaign" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingCampaign_slug_key" ON "public"."MarketingCampaign"("slug");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_isActive_idx" ON "public"."MarketingCampaign"("isActive");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_startsAt_idx" ON "public"."MarketingCampaign"("startsAt");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_endsAt_idx" ON "public"."MarketingCampaign"("endsAt");

CREATE TABLE IF NOT EXISTS "public"."MarketingCampaignResponse" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ratingStars" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketingCampaignResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingCampaignResponse_campaignId_userId_key"
  ON "public"."MarketingCampaignResponse"("campaignId", "userId");
CREATE INDEX IF NOT EXISTS "MarketingCampaignResponse_campaignId_idx" ON "public"."MarketingCampaignResponse"("campaignId");
CREATE INDEX IF NOT EXISTS "MarketingCampaignResponse_userId_idx" ON "public"."MarketingCampaignResponse"("userId");
CREATE INDEX IF NOT EXISTS "MarketingCampaignResponse_createdAt_idx" ON "public"."MarketingCampaignResponse"("createdAt");

ALTER TABLE "public"."MarketingCampaignResponse"
  ADD CONSTRAINT "MarketingCampaignResponse_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "public"."MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."MarketingCampaignResponse"
  ADD CONSTRAINT "MarketingCampaignResponse_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bootstrap: primeira campanha (Dia das Mães 2026).
-- Observação: datas opcionais; o app usa isActive=true e datas se existirem.
INSERT INTO "public"."MarketingCampaign" ("id", "slug", "title", "description", "isActive", "startsAt", "endsAt", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'dia-das-maes-2026',
  'Dia das Mães',
  'Conte-nos um pouco sobre a sua mãe e como ela contribuiu para que você estivesse aqui hoje, buscando uma qualificação profissional no IGH.',
  true,
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

