-- CreateTable
CREATE TABLE "LessonQuestionTeacherReply" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonQuestionTeacherReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonQuestionTeacherReply_questionId_idx" ON "LessonQuestionTeacherReply"("questionId");

-- CreateIndex
CREATE INDEX "LessonQuestionTeacherReply_teacherId_idx" ON "LessonQuestionTeacherReply"("teacherId");

-- AddForeignKey
ALTER TABLE "LessonQuestionTeacherReply" ADD CONSTRAINT "LessonQuestionTeacherReply_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "EnrollmentLessonQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonQuestionTeacherReply" ADD CONSTRAINT "LessonQuestionTeacherReply_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
