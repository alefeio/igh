-- CreateTable: progresso da aula por matrícula
CREATE TABLE "EnrollmentLessonProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "percentWatched" INTEGER NOT NULL DEFAULT 0,
    "percentRead" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrollmentLessonProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnrollmentLessonProgress_enrollmentId_lessonId_key" ON "EnrollmentLessonProgress"("enrollmentId", "lessonId");

ALTER TABLE "EnrollmentLessonProgress" ADD CONSTRAINT "EnrollmentLessonProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentLessonProgress" ADD CONSTRAINT "EnrollmentLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
