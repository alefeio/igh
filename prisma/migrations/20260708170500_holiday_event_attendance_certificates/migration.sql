-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN "responsibleTeacherId" TEXT;

-- AlterTable
ALTER TABLE "HolidayEventRegistration"
ADD COLUMN "attendanceMarkedAt" TIMESTAMP(3),
ADD COLUMN "attendanceMarkedByTeacherId" TEXT,
ADD COLUMN "certificateFileName" TEXT,
ADD COLUMN "certificatePublicId" TEXT,
ADD COLUMN "certificateUrl" TEXT,
ADD COLUMN "present" BOOLEAN;

-- CreateIndex
CREATE INDEX "Holiday_responsibleTeacherId_idx" ON "Holiday"("responsibleTeacherId");

-- CreateIndex
CREATE INDEX "HolidayEventRegistration_attendanceMarkedByTeacherId_idx" ON "HolidayEventRegistration"("attendanceMarkedByTeacherId");

-- AddForeignKey
ALTER TABLE "Holiday"
ADD CONSTRAINT "Holiday_responsibleTeacherId_fkey"
FOREIGN KEY ("responsibleTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayEventRegistration"
ADD CONSTRAINT "HolidayEventRegistration_attendanceMarkedByTeacherId_fkey"
FOREIGN KEY ("attendanceMarkedByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

