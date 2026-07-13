-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "signatureUrl" TEXT;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN "certificateIssuedAt" TIMESTAMP(3);
