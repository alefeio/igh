-- AlterTable
ALTER TABLE "ClassGroupExam" ADD COLUMN "createdByTeacherId" TEXT;

-- Preencher provas existentes com o professor da turma
UPDATE "ClassGroupExam" e
SET "createdByTeacherId" = cg."teacherId"
FROM "ClassGroup" cg
WHERE e."classGroupId" = cg."id" AND e."createdByTeacherId" IS NULL;

-- AddForeignKey
ALTER TABLE "ClassGroupExam" ADD CONSTRAINT "ClassGroupExam_createdByTeacherId_fkey" FOREIGN KEY ("createdByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ClassGroupExam_createdByTeacherId_idx" ON "ClassGroupExam"("createdByTeacherId");
