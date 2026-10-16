-- Aula opcional do material do professor. Registros existentes ficam sem aula.
ALTER TABLE "ClassGroupTeacherMaterial" ADD COLUMN "lessonId" TEXT;

CREATE INDEX "ClassGroupTeacherMaterial_lessonId_idx" ON "ClassGroupTeacherMaterial"("lessonId");

ALTER TABLE "ClassGroupTeacherMaterial" ADD CONSTRAINT "ClassGroupTeacherMaterial_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
