-- AlterTable: add lessonId to ClassSession (FK to CourseLesson)
ALTER TABLE "ClassSession" ADD COLUMN "lessonId" TEXT;

-- CreateForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
