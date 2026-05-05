-- Add Cycle model and attach ClassGroup to a Cycle

-- 1) Cycles table
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "isVisibleForEnrollments" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cycle_cycle_year_key" ON "Cycle"("cycle", "year");
CREATE INDEX "Cycle_year_cycle_idx" ON "Cycle"("year", "cycle");

-- 2) Seed first cycle deterministically (used as default)
INSERT INTO "Cycle" ("id", "cycle", "year", "isVisibleForEnrollments", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 1, 2026, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- 3) Add cycleId to ClassGroup with default to cycle 1/2026
ALTER TABLE "ClassGroup"
ADD COLUMN "cycleId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- 4) FK constraint
ALTER TABLE "ClassGroup"
ADD CONSTRAINT "ClassGroup_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ClassGroup_cycleId_idx" ON "ClassGroup"("cycleId");

