-- AlterTable: add pdfUrl and attachmentUrls to CourseLesson (material complementar)
ALTER TABLE "CourseLesson" ADD COLUMN "pdfUrl" TEXT;
ALTER TABLE "CourseLesson" ADD COLUMN "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
