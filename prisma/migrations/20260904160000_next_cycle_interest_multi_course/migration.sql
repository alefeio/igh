-- AlterTable: multi-curso na pré-inscrição
ALTER TABLE "NextCycleInterest" ADD COLUMN IF NOT EXISTS "courseIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill a partir do courseId legado (quando existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'NextCycleInterest' AND column_name = 'courseId'
  ) THEN
    UPDATE "NextCycleInterest"
    SET "courseIds" = ARRAY["courseId"]
    WHERE "courseId" IS NOT NULL
      AND (cardinality("courseIds") = 0 OR "courseIds" IS NULL);

    ALTER TABLE "NextCycleInterest" DROP CONSTRAINT IF EXISTS "NextCycleInterest_courseId_fkey";
    DROP INDEX IF EXISTS "NextCycleInterest_courseId_idx";
    ALTER TABLE "NextCycleInterest" DROP COLUMN IF EXISTS "courseId";
  END IF;
END $$;
