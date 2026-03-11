-- CreateTable
CREATE TABLE "SessionAttendance" (
    "id" TEXT NOT NULL,
    "classSessionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionAttendance_classSessionId_idx" ON "SessionAttendance"("classSessionId");

-- CreateIndex
CREATE INDEX "SessionAttendance_enrollmentId_idx" ON "SessionAttendance"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAttendance_classSessionId_enrollmentId_key" ON "SessionAttendance"("classSessionId", "enrollmentId");

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
