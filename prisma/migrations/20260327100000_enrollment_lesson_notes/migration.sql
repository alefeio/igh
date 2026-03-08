-- CreateTable: anotações por matrícula e aula
CREATE TABLE "EnrollmentLessonNote" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "videoTimestampSecs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrollmentLessonNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EnrollmentLessonNote_enrollmentId_lessonId_idx" ON "EnrollmentLessonNote"("enrollmentId", "lessonId");

ALTER TABLE "EnrollmentLessonNote" ADD CONSTRAINT "EnrollmentLessonNote_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentLessonNote" ADD CONSTRAINT "EnrollmentLessonNote_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
