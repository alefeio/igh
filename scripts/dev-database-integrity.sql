-- Integridade não representada pelo schema.prisma.
-- Aplicado só no bootstrap do banco Docker local, depois do SQL gerado pelo Prisma.
ALTER TABLE "EnrollmentLessonQuestion"
  DROP CONSTRAINT IF EXISTS "EnrollmentLessonQuestion_single_author_check";

ALTER TABLE "EnrollmentLessonQuestion"
  ADD CONSTRAINT "EnrollmentLessonQuestion_single_author_check"
  CHECK (
    ("enrollmentId" IS NOT NULL AND "teacherAuthorId" IS NULL)
    OR
    ("enrollmentId" IS NULL AND "teacherAuthorId" IS NOT NULL)
  );
