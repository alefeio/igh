-- Script para alinhar a tabela SiteSettings ao schema (endereços como array).
-- Execute se o Prisma acusar "column does not exist" em SiteSettings.
-- Pode ser executado mais de uma vez (idempotente).

-- 1) Adicionar coluna addresses se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SiteSettings' AND column_name = 'addresses'
  ) THEN
    ALTER TABLE "SiteSettings" ADD COLUMN "addresses" JSONB;
  END IF;
END $$;

-- 2) Preencher addresses a partir das colunas antigas (se existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SiteSettings' AND column_name = 'addressLine') THEN
    UPDATE "SiteSettings"
    SET "addresses" = jsonb_build_array(
      jsonb_build_object(
        'line', COALESCE("addressLine", ''),
        'city', COALESCE("addressCity", ''),
        'state', COALESCE("addressState", ''),
        'zip', COALESCE("addressZip", '')
      )
    )
    WHERE "addresses" IS NULL AND ("addressLine" IS NOT NULL OR "addressCity" IS NOT NULL OR "addressState" IS NOT NULL OR "addressZip" IS NOT NULL);
  END IF;
END $$;

UPDATE "SiteSettings" SET "addresses" = '[]'::jsonb WHERE "addresses" IS NULL;

-- 3) Remover colunas antigas se existirem
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "addressLine";
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "addressCity";
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "addressState";
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "addressZip";
