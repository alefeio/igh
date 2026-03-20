-- AlterTable: três notas (plataforma, aulas, professor) no lugar de uma única `rating`.

ALTER TABLE "PlatformExperienceFeedback" ADD COLUMN "ratingPlatform" INTEGER;
ALTER TABLE "PlatformExperienceFeedback" ADD COLUMN "ratingLessons" INTEGER;
ALTER TABLE "PlatformExperienceFeedback" ADD COLUMN "ratingTeacher" INTEGER;

UPDATE "PlatformExperienceFeedback"
SET
  "ratingPlatform" = "rating",
  "ratingLessons" = "rating",
  "ratingTeacher" = "rating"
WHERE "rating" IS NOT NULL;

ALTER TABLE "PlatformExperienceFeedback" ALTER COLUMN "ratingPlatform" SET NOT NULL;
ALTER TABLE "PlatformExperienceFeedback" ALTER COLUMN "ratingLessons" SET NOT NULL;
ALTER TABLE "PlatformExperienceFeedback" ALTER COLUMN "ratingTeacher" SET NOT NULL;

ALTER TABLE "PlatformExperienceFeedback" DROP COLUMN "rating";
