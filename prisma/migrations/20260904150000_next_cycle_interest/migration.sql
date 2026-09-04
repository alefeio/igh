-- CreateTable
CREATE TABLE "NextCycleInterest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "courseId" TEXT,
    "customCourseName" TEXT,
    "source" TEXT DEFAULT 'site',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NextCycleInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NextCycleInterest_email_idx" ON "NextCycleInterest"("email");

-- CreateIndex
CREATE INDEX "NextCycleInterest_phone_idx" ON "NextCycleInterest"("phone");

-- CreateIndex
CREATE INDEX "NextCycleInterest_courseId_idx" ON "NextCycleInterest"("courseId");

-- CreateIndex
CREATE INDEX "NextCycleInterest_createdAt_idx" ON "NextCycleInterest"("createdAt");

-- AddForeignKey
ALTER TABLE "NextCycleInterest" ADD CONSTRAINT "NextCycleInterest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
