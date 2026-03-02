-- Add slug column (nullable first for backfill)
ALTER TABLE "Course" ADD COLUMN "slug" TEXT;

-- Backfill slug from name (slugify: lowercase, replace non-alphanumeric with '', spaces with '-')
UPDATE "Course"
SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM("name"), '[^a-zA-Z0-9\s\-]', '', 'g'), '\s+', '-', 'g'))
WHERE "slug" IS NULL;

-- Ensure no empty slug
UPDATE "Course" SET "slug" = 'curso-' || SUBSTRING(REPLACE("id"::text, '-', ''), 1, 8) WHERE "slug" = '' OR "slug" IS NULL;

-- Resolve duplicates: keep first per slug, suffix others with id
WITH numbered AS (
  SELECT "id", "slug", ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "createdAt", "id") AS rn
  FROM "Course"
)
UPDATE "Course" c
SET "slug" = n."slug" || '-' || SUBSTRING(REPLACE(n."id"::text, '-', ''), 1, 8)
FROM numbered n
WHERE c."id" = n."id" AND n.rn > 1;

-- Make slug required and unique
UPDATE "Course" SET "slug" = 'curso-' || SUBSTRING(REPLACE("id"::text, '-', ''), 1, 8) WHERE "slug" IS NULL;
ALTER TABLE "Course" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");
