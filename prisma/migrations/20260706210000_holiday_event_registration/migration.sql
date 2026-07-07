-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN "allowsRegistration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Holiday" ADD COLUMN "publicDescription" TEXT;

-- CreateTable
CREATE TABLE "HolidayEventRegistration" (
    "id" TEXT NOT NULL,
    "holidayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurrenceDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmationEmailSentAt" TIMESTAMP(3),
    "reminderEmailSentAt" TIMESTAMP(3),

    CONSTRAINT "HolidayEventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HolidayEventRegistration_holidayId_userId_occurrenceDate_key" ON "HolidayEventRegistration"("holidayId", "userId", "occurrenceDate");
CREATE INDEX "HolidayEventRegistration_occurrenceDate_idx" ON "HolidayEventRegistration"("occurrenceDate");
CREATE INDEX "HolidayEventRegistration_userId_idx" ON "HolidayEventRegistration"("userId");
CREATE INDEX "HolidayEventRegistration_holidayId_occurrenceDate_idx" ON "HolidayEventRegistration"("holidayId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "HolidayEventRegistration" ADD CONSTRAINT "HolidayEventRegistration_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "Holiday"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HolidayEventRegistration" ADD CONSTRAINT "HolidayEventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
