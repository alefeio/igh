-- AlterTable
ALTER TABLE "Course" ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Course_createdByUserId_idx" ON "Course"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from audit logs (first CREATE per curso)
UPDATE "Course" AS c
SET "createdByUserId" = src."performedByUserId"
FROM (
  SELECT DISTINCT ON ("entityId")
    "entityId",
    "performedByUserId"
  FROM "AuditLog"
  WHERE "entityType" = 'Course'
    AND "action" = 'CREATE'
    AND "performedByUserId" IS NOT NULL
  ORDER BY "entityId", "createdAt" ASC
) AS src
WHERE c.id = src."entityId"
  AND c."createdByUserId" IS NULL;
