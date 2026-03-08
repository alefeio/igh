-- CreateTable: respostas dos alunos aos exercícios (persistência)
CREATE TABLE "EnrollmentLessonExerciseAnswer" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "selectedOptionId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentLessonExerciseAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnrollmentLessonExerciseAnswer_enrollmentId_exerciseId_key" ON "EnrollmentLessonExerciseAnswer"("enrollmentId", "exerciseId");

ALTER TABLE "EnrollmentLessonExerciseAnswer" ADD CONSTRAINT "EnrollmentLessonExerciseAnswer_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
