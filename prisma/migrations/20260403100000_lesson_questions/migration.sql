-- CreateTable: dúvidas/comentários por aula (fórum)
CREATE TABLE "EnrollmentLessonQuestion" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentLessonQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EnrollmentLessonQuestion_enrollmentId_lessonId_idx" ON "EnrollmentLessonQuestion"("enrollmentId", "lessonId");
CREATE INDEX "EnrollmentLessonQuestion_lessonId_idx" ON "EnrollmentLessonQuestion"("lessonId");

ALTER TABLE "EnrollmentLessonQuestion" ADD CONSTRAINT "EnrollmentLessonQuestion_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
