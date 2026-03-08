-- CreateTable: respostas a comentários/dúvidas (Responder ao comentário)
CREATE TABLE "EnrollmentLessonQuestionReply" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentLessonQuestionReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EnrollmentLessonQuestionReply_questionId_idx" ON "EnrollmentLessonQuestionReply"("questionId");
CREATE INDEX "EnrollmentLessonQuestionReply_enrollmentId_idx" ON "EnrollmentLessonQuestionReply"("enrollmentId");

ALTER TABLE "EnrollmentLessonQuestionReply" ADD CONSTRAINT "EnrollmentLessonQuestionReply_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "EnrollmentLessonQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentLessonQuestionReply" ADD CONSTRAINT "EnrollmentLessonQuestionReply_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
