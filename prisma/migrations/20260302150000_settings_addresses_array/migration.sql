-- Add addresses JSONB column
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "addresses" JSONB;

-- Migrate existing single address into array
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

-- Set empty array where no address was set
UPDATE "SiteSettings" SET "addresses" = '[]'::jsonb WHERE "addresses" IS NULL;

-- Drop old columns
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "addressLine";
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "addressCity";
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "addressState";
ALTER TABLE "SiteSettings" DROP COLUMN IF EXISTS "addressZip";
