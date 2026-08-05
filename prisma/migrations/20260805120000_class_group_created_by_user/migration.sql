-- AlterTable
ALTER TABLE "ClassGroup" ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "ClassGroup_createdByUserId_idx" ON "ClassGroup"("createdByUserId");

-- AddForeignKey
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from audit logs (first CREATE_CLASSGROUP per turma)
UPDATE "ClassGroup" AS cg
SET "createdByUserId" = src."performedByUserId"
FROM (
  SELECT DISTINCT ON ("entityId")
    "entityId",
    "performedByUserId"
  FROM "AuditLog"
  WHERE "entityType" = 'ClassGroup'
    AND "action" = 'CREATE_CLASSGROUP'
    AND "performedByUserId" IS NOT NULL
  ORDER BY "entityId", "createdAt" ASC
) AS src
WHERE cg.id = src."entityId"
  AND cg."createdByUserId" IS NULL;
