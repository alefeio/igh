-- Permite várias tentativas por exercício; FK de resposta para o exercício
DROP INDEX IF EXISTS "EnrollmentLessonExerciseAnswer_enrollmentId_exerciseId_key";

ALTER TABLE "EnrollmentLessonExerciseAnswer" ADD CONSTRAINT "EnrollmentLessonExerciseAnswer_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "CourseLessonExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "EnrollmentLessonExerciseAnswer_enrollmentId_exerciseId_createdAt_idx" ON "EnrollmentLessonExerciseAnswer"("enrollmentId", "exerciseId", "createdAt");
