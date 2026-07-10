-- AlterTable User: WhatsApp no cadastro
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT;

-- AlterTable HolidayEventRegistration: inscrição convidada (sem conta)
ALTER TABLE "HolidayEventRegistration" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "HolidayEventRegistration" ADD COLUMN IF NOT EXISTS "guestName" TEXT;
ALTER TABLE "HolidayEventRegistration" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;
ALTER TABLE "HolidayEventRegistration" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
ALTER TABLE "HolidayEventRegistration" ADD COLUMN IF NOT EXISTS "guestCpf" TEXT;

-- Unique para convidados (telefone + ocorrência). NULLs de user regs não conflitam no Postgres.
CREATE UNIQUE INDEX IF NOT EXISTS "HolidayEventRegistration_holidayId_guestPhone_occurrenceDate_key"
ON "HolidayEventRegistration"("holidayId", "guestPhone", "occurrenceDate");

CREATE INDEX IF NOT EXISTS "HolidayEventRegistration_guestPhone_idx"
ON "HolidayEventRegistration"("guestPhone");
