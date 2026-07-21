-- Allow a forum topic to be authored either by a student enrollment or by a teacher.
ALTER TABLE "EnrollmentLessonQuestion"
  ALTER COLUMN "enrollmentId" DROP NOT NULL,
  ADD COLUMN "teacherAuthorId" TEXT;

ALTER TABLE "EnrollmentLessonQuestion"
  ADD CONSTRAINT "EnrollmentLessonQuestion_teacherAuthorId_fkey"
  FOREIGN KEY ("teacherAuthorId") REFERENCES "Teacher"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "EnrollmentLessonQuestion_teacherAuthorId_idx"
  ON "EnrollmentLessonQuestion"("teacherAuthorId");

ALTER TABLE "EnrollmentLessonQuestion"
  ADD CONSTRAINT "EnrollmentLessonQuestion_single_author_check"
  CHECK (
    ("enrollmentId" IS NOT NULL AND "teacherAuthorId" IS NULL)
    OR
    ("enrollmentId" IS NULL AND "teacherAuthorId" IS NOT NULL)
  );
