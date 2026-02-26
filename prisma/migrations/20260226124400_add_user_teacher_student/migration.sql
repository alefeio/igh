-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'TEACHER';
ALTER TYPE "UserRole" ADD VALUE 'STUDENT';

-- AlterTable Teacher
ALTER TABLE "Teacher" ADD COLUMN "userId" TEXT;

-- AlterTable Student
ALTER TABLE "Student" ADD COLUMN "userId" TEXT;

-- CreateIndex Teacher
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

-- CreateIndex Student
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- AddForeignKey Teacher
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Student
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
