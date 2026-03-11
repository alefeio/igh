-- AlterTable: add attachmentNames to CourseLesson (display name per attachment URL)
ALTER TABLE "CourseLesson" ADD COLUMN "attachmentNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
