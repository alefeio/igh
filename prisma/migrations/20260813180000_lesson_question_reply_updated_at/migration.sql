-- AlterTable
ALTER TABLE "EnrollmentLessonQuestionReply" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "EnrollmentLessonQuestionReply" SET "updatedAt" = "createdAt";
