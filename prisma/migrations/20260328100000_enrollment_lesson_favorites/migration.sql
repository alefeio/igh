-- CreateTable: favoritos por matrícula e aula
CREATE TABLE "EnrollmentLessonFavorite" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentLessonFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnrollmentLessonFavorite_enrollmentId_lessonId_key" ON "EnrollmentLessonFavorite"("enrollmentId", "lessonId");

ALTER TABLE "EnrollmentLessonFavorite" ADD CONSTRAINT "EnrollmentLessonFavorite_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentLessonFavorite" ADD CONSTRAINT "EnrollmentLessonFavorite_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
