-- AlterTable: catálogo de instituições doadoras (antes era singleton)
ALTER TABLE "DonorInstitutionSettings" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DonorInstitutionSettings" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DonorInstitutionSettings" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "DonorInstitutionSettings" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "DonorInstitutionSettings"
SET "isDefault" = true
WHERE id = (
  SELECT id FROM "DonorInstitutionSettings"
  ORDER BY "updatedAt" DESC
  LIMIT 1
);

CREATE INDEX IF NOT EXISTS "DonorInstitutionSettings_deletedAt_isActive_idx"
  ON "DonorInstitutionSettings"("deletedAt", "isActive");
CREATE INDEX IF NOT EXISTS "DonorInstitutionSettings_isDefault_idx"
  ON "DonorInstitutionSettings"("isDefault");

-- AlterTable: termo de doação escolhe a doadora
ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "donorInstitutionId" TEXT;

CREATE INDEX IF NOT EXISTS "Donation_donorInstitutionId_idx" ON "Donation"("donorInstitutionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Donation_donorInstitutionId_fkey'
  ) THEN
    ALTER TABLE "Donation"
      ADD CONSTRAINT "Donation_donorInstitutionId_fkey"
      FOREIGN KEY ("donorInstitutionId") REFERENCES "DonorInstitutionSettings"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
