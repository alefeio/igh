-- AlterTable
ALTER TABLE "Cycle" ADD COLUMN "enrollmentDeadlineDate" DATE;

-- AlterTable: escopar pré-inscrições ao ciclo vigente
ALTER TABLE "NextCycleInterest" ADD COLUMN "cycleId" TEXT;

-- Backfill: associa interesses existentes ao ciclo atual (último por ano/número)
UPDATE "NextCycleInterest" n
SET "cycleId" = (
  SELECT c."id"
  FROM "Cycle" c
  ORDER BY c."year" DESC, c."cycle" DESC
  LIMIT 1
)
WHERE n."cycleId" IS NULL;

-- Se não houver ciclo, remove órfãos (não deve ocorrer em produção)
DELETE FROM "NextCycleInterest" WHERE "cycleId" IS NULL;

-- AlterTable
ALTER TABLE "NextCycleInterest" ALTER COLUMN "cycleId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "NextCycleInterest_cycleId_createdAt_idx" ON "NextCycleInterest"("cycleId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "NextCycleInterest" ADD CONSTRAINT "NextCycleInterest_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
