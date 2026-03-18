-- CreateTable: exercícios de múltipla escolha por aula
CREATE TABLE "CourseLessonExercise" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "question" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLessonExercise_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseLessonExerciseOption" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLessonExerciseOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseLessonExercise_lessonId_idx" ON "CourseLessonExercise"("lessonId");

ALTER TABLE "CourseLessonExercise" ADD CONSTRAINT "CourseLessonExercise_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseLessonExerciseOption" ADD CONSTRAINT "CourseLessonExerciseOption_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "CourseLessonExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
