-- CreateTable
CREATE TABLE "FinancialEntryAttachment" (
    "id" TEXT NOT NULL,
    "financialEntryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "fileName" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialEntryAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialEntryAttachment_financialEntryId_createdAt_idx" ON "FinancialEntryAttachment"("financialEntryId", "createdAt");

ALTER TABLE "FinancialEntryAttachment" ADD CONSTRAINT "FinancialEntryAttachment_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copia o anexo único legado para a nova tabela.
INSERT INTO "FinancialEntryAttachment" ("id", "financialEntryId", "url", "publicId", "fileName", "description", "createdAt")
SELECT gen_random_uuid()::text,
       "id",
       "attachmentUrl",
       "attachmentPublicId",
       "attachmentFileName",
       COALESCE(NULLIF(BTRIM("attachmentFileName"), ''), 'Anexo'),
       CURRENT_TIMESTAMP
FROM "FinancialEntry"
WHERE "attachmentUrl" IS NOT NULL AND BTRIM("attachmentUrl") <> '';
