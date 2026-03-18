-- CreateTable: trechos destacados pelo aluno (marca-texto) por aula
CREATE TABLE "EnrollmentLessonPassage" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentLessonPassage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EnrollmentLessonPassage_enrollmentId_lessonId_idx" ON "EnrollmentLessonPassage"("enrollmentId", "lessonId");

ALTER TABLE "EnrollmentLessonPassage" ADD CONSTRAINT "EnrollmentLessonPassage_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentLessonPassage" ADD CONSTRAINT "EnrollmentLessonPassage_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
