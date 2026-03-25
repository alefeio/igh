-- AlterTable: respostas podem ser do professor (teacherId) ou admin/master (staffUserId)
ALTER TABLE "LessonQuestionTeacherReply" ADD COLUMN IF NOT EXISTS "staffUserId" TEXT;

ALTER TABLE "LessonQuestionTeacherReply" DROP CONSTRAINT IF EXISTS "LessonQuestionTeacherReply_teacherId_fkey";

ALTER TABLE "LessonQuestionTeacherReply" ALTER COLUMN "teacherId" DROP NOT NULL;

ALTER TABLE "LessonQuestionTeacherReply" ADD CONSTRAINT "LessonQuestionTeacherReply_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "LessonQuestionTeacherReply_staffUserId_idx" ON "LessonQuestionTeacherReply"("staffUserId");

ALTER TABLE "LessonQuestionTeacherReply" ADD CONSTRAINT "LessonQuestionTeacherReply_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
