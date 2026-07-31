-- CreateTable
CREATE TABLE "EnrollmentWaitlist" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "notes" TEXT,
    "convertedEnrollmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrollmentWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentWaitlist_convertedEnrollmentId_key" ON "EnrollmentWaitlist"("convertedEnrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentWaitlist_classGroupId_status_createdAt_idx" ON "EnrollmentWaitlist"("classGroupId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EnrollmentWaitlist_studentId_status_idx" ON "EnrollmentWaitlist"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentWaitlist_classGroupId_studentId_key" ON "EnrollmentWaitlist"("classGroupId", "studentId");

-- AddForeignKey
ALTER TABLE "EnrollmentWaitlist" ADD CONSTRAINT "EnrollmentWaitlist_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentWaitlist" ADD CONSTRAINT "EnrollmentWaitlist_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentWaitlist" ADD CONSTRAINT "EnrollmentWaitlist_convertedEnrollmentId_fkey" FOREIGN KEY ("convertedEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;