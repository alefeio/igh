-- Avaliação do aluno sobre o professor da turma. Uma por matrícula. Anônima esconde o nome na listagem.

CREATE TABLE "TeacherClassEvaluation" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "anonymous" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherClassEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherClassEvaluation_enrollmentId_key" ON "TeacherClassEvaluation"("enrollmentId");
CREATE INDEX "TeacherClassEvaluation_teacherId_createdAt_idx" ON "TeacherClassEvaluation"("teacherId", "createdAt");

ALTER TABLE "TeacherClassEvaluation" ADD CONSTRAINT "TeacherClassEvaluation_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherClassEvaluation" ADD CONSTRAINT "TeacherClassEvaluation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
