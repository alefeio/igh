-- Rodadas de disparo da campanha (envio em massa)
ALTER TABLE "EmailCampaign" ADD COLUMN "dispatchCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "EmailCampaign" SET "dispatchCount" = 1 WHERE "startedAt" IS NOT NULL;
