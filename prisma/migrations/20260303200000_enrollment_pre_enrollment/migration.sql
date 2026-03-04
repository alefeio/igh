-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "isPreEnrollment" BOOLEAN NOT NULL DEFAULT false;
