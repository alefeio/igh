-- CreateEnum
CREATE TYPE "DonationAttachmentKind" AS ENUM ('GERADO', 'ASSINADO', 'OUTRO');

-- CreateTable
CREATE TABLE "DonationAttachment" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "fileName" TEXT,
    "description" TEXT NOT NULL,
    "kind" "DonationAttachmentKind" NOT NULL DEFAULT 'OUTRO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DonationAttachment_donationId_createdAt_idx" ON "DonationAttachment"("donationId", "createdAt");

-- CreateIndex
CREATE INDEX "DonationAttachment_donationId_kind_idx" ON "DonationAttachment"("donationId", "kind");

-- AddForeignKey
ALTER TABLE "DonationAttachment" ADD CONSTRAINT "DonationAttachment_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: espelha pdfUrl legado como anexo GERADO
INSERT INTO "DonationAttachment" ("id", "donationId", "url", "publicId", "fileName", "description", "kind", "createdAt")
SELECT
  gen_random_uuid()::text,
  d."id",
  d."pdfUrl",
  d."pdfPublicId",
  CASE
    WHEN d."termNumber" IS NOT NULL THEN 'termo-doacao-' || d."termNumber"::text || '.pdf'
    ELSE 'termo-doacao.pdf'
  END,
  'PDF gerado',
  'GERADO'::"DonationAttachmentKind",
  COALESCE(d."updatedAt", d."createdAt", NOW())
FROM "Donation" d
WHERE d."pdfUrl" IS NOT NULL
  AND d."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "DonationAttachment" a
    WHERE a."donationId" = d."id" AND a."kind" = 'GERADO'::"DonationAttachmentKind"
  );
