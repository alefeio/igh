-- AlterTable: auditoria de última edição da aula (quem alterou o conteúdo)
ALTER TABLE "CourseLesson" ADD COLUMN "lastEditedByUserId" TEXT;
ALTER TABLE "CourseLesson" ADD COLUMN "lastEditedAt" TIMESTAMP(3);

ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_lastEditedByUserId_fkey" FOREIGN KEY ("lastEditedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
