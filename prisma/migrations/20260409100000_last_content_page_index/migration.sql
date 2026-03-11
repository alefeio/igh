-- AlterTable: add lastContentPageIndex to EnrollmentLessonProgress (último slide visualizado)
ALTER TABLE "EnrollmentLessonProgress" ADD COLUMN "lastContentPageIndex" INTEGER;
