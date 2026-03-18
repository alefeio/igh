-- AlterTable: PDF e URLs de anexos complementares na aula
ALTER TABLE "CourseLesson" ADD COLUMN "pdfUrl" TEXT;
ALTER TABLE "CourseLesson" ADD COLUMN "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
