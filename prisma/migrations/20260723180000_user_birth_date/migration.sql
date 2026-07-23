-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthDate" DATE;

-- Backfill a partir do cadastro de aluno (quando existir e for data real).
UPDATE "User" u
SET
  "birthDate" = COALESCE(u."birthDate", s."birthDate"),
  "whatsapp" = COALESCE(
    NULLIF(TRIM(u."whatsapp"), ''),
    NULLIF(regexp_replace(COALESCE(s."phone", ''), '\D', '', 'g'), '')
  )
FROM "Student" s
WHERE s."userId" = u.id
  AND s."deletedAt" IS NULL
  AND s."birthDate" > DATE '1970-01-01';
