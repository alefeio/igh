-- AlterTable: histórico de estudo (último acesso e tempo estudado)
ALTER TABLE "EnrollmentLessonProgress" ADD COLUMN "lastAccessedAt" TIMESTAMP(3);
ALTER TABLE "EnrollmentLessonProgress" ADD COLUMN "totalMinutesStudied" INTEGER NOT NULL DEFAULT 0;
