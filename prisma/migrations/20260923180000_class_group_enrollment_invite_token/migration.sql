-- AlterTable
ALTER TABLE "ClassGroup" ADD COLUMN IF NOT EXISTS "enrollmentInviteToken" TEXT;

-- Backfill tokens (md5 is built-in; no pgcrypto required)
UPDATE "ClassGroup"
SET "enrollmentInviteToken" = md5(random()::text || id || clock_timestamp()::text)
WHERE "enrollmentInviteToken" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ClassGroup_enrollmentInviteToken_key"
  ON "ClassGroup"("enrollmentInviteToken");
