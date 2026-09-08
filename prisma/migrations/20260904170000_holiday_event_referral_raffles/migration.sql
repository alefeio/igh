-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN     "slug" TEXT,
ADD COLUMN     "allowsReferral" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresReferral" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "capacity" INTEGER;

-- AlterTable
ALTER TABLE "HolidayEventRegistration" ADD COLUMN     "attendanceMarkedByUserId" TEXT,
ADD COLUMN     "checkinCode" TEXT,
ADD COLUMN     "referrerUserId" TEXT,
ADD COLUMN     "referrerQuery" TEXT;

-- CreateTable
CREATE TABLE "HolidayEventRaffle" (
    "id" TEXT NOT NULL,
    "holidayId" TEXT NOT NULL,
    "occurrenceDate" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prize" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "allowRepeatWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayEventRaffle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayEventRaffleTicket" (
    "id" TEXT NOT NULL,
    "holidayId" TEXT NOT NULL,
    "occurrenceDate" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HolidayEventRaffleTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayEventRaffleDraw" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "eligibleCount" INTEGER NOT NULL,
    "drawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drawnByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WINNER',

    CONSTRAINT "HolidayEventRaffleDraw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_slug_key" ON "Holiday"("slug");

-- CreateIndex
CREATE INDEX "Holiday_slug_idx" ON "Holiday"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayEventRegistration_holidayId_occurrenceDate_checkinCo_key" ON "HolidayEventRegistration"("holidayId", "occurrenceDate", "checkinCode");

-- CreateIndex
CREATE INDEX "HolidayEventRegistration_attendanceMarkedByUserId_idx" ON "HolidayEventRegistration"("attendanceMarkedByUserId");

-- CreateIndex
CREATE INDEX "HolidayEventRegistration_referrerUserId_idx" ON "HolidayEventRegistration"("referrerUserId");

-- CreateIndex
CREATE INDEX "HolidayEventRaffle_holidayId_occurrenceDate_idx" ON "HolidayEventRaffle"("holidayId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "HolidayEventRaffle_status_idx" ON "HolidayEventRaffle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayEventRaffleTicket_registrationId_key" ON "HolidayEventRaffleTicket"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayEventRaffleTicket_holidayId_occurrenceDate_number_key" ON "HolidayEventRaffleTicket"("holidayId", "occurrenceDate", "number");

-- CreateIndex
CREATE INDEX "HolidayEventRaffleTicket_holidayId_occurrenceDate_idx" ON "HolidayEventRaffleTicket"("holidayId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "HolidayEventRaffleDraw_raffleId_status_idx" ON "HolidayEventRaffleDraw"("raffleId", "status");

-- CreateIndex
CREATE INDEX "HolidayEventRaffleDraw_ticketId_idx" ON "HolidayEventRaffleDraw"("ticketId");

-- AddForeignKey
ALTER TABLE "HolidayEventRegistration" ADD CONSTRAINT "HolidayEventRegistration_attendanceMarkedByUserId_fkey" FOREIGN KEY ("attendanceMarkedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayEventRegistration" ADD CONSTRAINT "HolidayEventRegistration_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayEventRaffle" ADD CONSTRAINT "HolidayEventRaffle_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "Holiday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayEventRaffleTicket" ADD CONSTRAINT "HolidayEventRaffleTicket_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "Holiday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayEventRaffleTicket" ADD CONSTRAINT "HolidayEventRaffleTicket_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "HolidayEventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayEventRaffleDraw" ADD CONSTRAINT "HolidayEventRaffleDraw_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "HolidayEventRaffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayEventRaffleDraw" ADD CONSTRAINT "HolidayEventRaffleDraw_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "HolidayEventRaffleTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayEventRaffleDraw" ADD CONSTRAINT "HolidayEventRaffleDraw_drawnByUserId_fkey" FOREIGN KEY ("drawnByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: slug dos eventos existentes a partir do nome, com sufixo numérico em caso de colisão.
WITH base AS (
    SELECT
        "id",
        NULLIF(
            trim(both '-' from regexp_replace(
                lower(translate(
                    coalesce("name", ''),
                    'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäåéèêëíìîïóòôõöúùûüçñ',
                    'AAAAAAEEEEIIIIOOOOOUUUUCNaaaaaaeeeeiiiiooooouuuucn'
                )),
                '[^a-z0-9]+', '-', 'g'
            )),
            ''
        ) AS base_slug
    FROM "Holiday"
    WHERE "eventStartTime" IS NOT NULL AND "slug" IS NULL
), numbered AS (
    SELECT "id", base_slug, row_number() OVER (PARTITION BY base_slug ORDER BY "id") AS rn
    FROM base
    WHERE base_slug IS NOT NULL
)
UPDATE "Holiday" h
SET "slug" = CASE WHEN n.rn = 1 THEN n.base_slug ELSE n.base_slug || '-' || n.rn END
FROM numbered n
WHERE h."id" = n."id";
