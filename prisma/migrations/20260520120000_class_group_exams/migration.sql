-- CreateEnum
CREATE TYPE "ClassGroupExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "ClassGroupExamTimingMode" AS ENUM ('FROM_STUDENT_START', 'FROM_EXAM_START');
CREATE TYPE "ClassGroupExamSelectionMode" AS ENUM ('RANDOM', 'MANUAL');
CREATE TYPE "ClassGroupExamAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED');

-- CreateTable
CREATE TABLE "ClassGroupExam" (
    "id" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "status" "ClassGroupExamStatus" NOT NULL DEFAULT 'DRAFT',
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "availableUntil" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "timingMode" "ClassGroupExamTimingMode" NOT NULL DEFAULT 'FROM_STUDENT_START',
    "selectionMode" "ClassGroupExamSelectionMode" NOT NULL DEFAULT 'RANDOM',
    "questionCount" INTEGER NOT NULL,
    "manualExerciseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT true,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "showScoreAfterSubmit" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassGroupExam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassGroupExamAttempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "ClassGroupExamAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "scorePercent" INTEGER,
    "correctCount" INTEGER,
    "totalQuestions" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassGroupExamAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassGroupExamAttemptQuestion" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "optionsJson" JSONB NOT NULL,
    "correctOptionId" TEXT NOT NULL,

    CONSTRAINT "ClassGroupExamAttemptQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassGroupExamAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "attemptQuestionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "correct" BOOLEAN,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ClassGroupExamAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassGroupExam_classGroupId_idx" ON "ClassGroupExam"("classGroupId");
CREATE INDEX "ClassGroupExam_classGroupId_status_idx" ON "ClassGroupExam"("classGroupId", "status");
CREATE INDEX "ClassGroupExamAttempt_examId_idx" ON "ClassGroupExamAttempt"("examId");
CREATE INDEX "ClassGroupExamAttempt_enrollmentId_idx" ON "ClassGroupExamAttempt"("enrollmentId");
CREATE UNIQUE INDEX "ClassGroupExamAttempt_examId_enrollmentId_attemptNumber_key" ON "ClassGroupExamAttempt"("examId", "enrollmentId", "attemptNumber");
CREATE INDEX "ClassGroupExamAttemptQuestion_attemptId_idx" ON "ClassGroupExamAttemptQuestion"("attemptId");
CREATE UNIQUE INDEX "ClassGroupExamAnswer_attemptQuestionId_key" ON "ClassGroupExamAnswer"("attemptQuestionId");
CREATE INDEX "ClassGroupExamAnswer_attemptId_idx" ON "ClassGroupExamAnswer"("attemptId");
CREATE UNIQUE INDEX "ClassGroupExamAnswer_attemptId_attemptQuestionId_key" ON "ClassGroupExamAnswer"("attemptId", "attemptQuestionId");

-- AddForeignKey
ALTER TABLE "ClassGroupExam" ADD CONSTRAINT "ClassGroupExam_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassGroupExamAttempt" ADD CONSTRAINT "ClassGroupExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "ClassGroupExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassGroupExamAttempt" ADD CONSTRAINT "ClassGroupExamAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassGroupExamAttemptQuestion" ADD CONSTRAINT "ClassGroupExamAttemptQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ClassGroupExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassGroupExamAnswer" ADD CONSTRAINT "ClassGroupExamAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ClassGroupExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassGroupExamAnswer" ADD CONSTRAINT "ClassGroupExamAnswer_attemptQuestionId_fkey" FOREIGN KEY ("attemptQuestionId") REFERENCES "ClassGroupExamAttemptQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
