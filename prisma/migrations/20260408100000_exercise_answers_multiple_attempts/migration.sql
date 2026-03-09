-- Permitir múltiplas tentativas por exercício: remover unique e adicionar índice para buscar a mais recente
DROP INDEX IF EXISTS "EnrollmentLessonExerciseAnswer_enrollmentId_exerciseId_key";
CREATE INDEX "EnrollmentLessonExerciseAnswer_enrollmentId_exerciseId_createdAt_idx" ON "EnrollmentLessonExerciseAnswer"("enrollmentId", "exerciseId", "createdAt");
