-- Quadro: visibilidade privada e vários responsáveis (aditivo)

ALTER TABLE "BoardActivity" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "BoardActivityAssignee" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "BoardActivityAssignee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BoardActivityAssignee_activityId_userId_key"
  ON "BoardActivityAssignee"("activityId", "userId");
CREATE INDEX IF NOT EXISTS "BoardActivityAssignee_userId_idx"
  ON "BoardActivityAssignee"("userId");
CREATE INDEX IF NOT EXISTS "BoardActivity_isPrivate_idx"
  ON "BoardActivity"("isPrivate");

INSERT INTO "BoardActivityAssignee" ("id", "activityId", "userId")
SELECT gen_random_uuid()::text, a."id", a."assigneeId"
FROM "BoardActivity" a
WHERE NOT EXISTS (
  SELECT 1 FROM "BoardActivityAssignee" x
  WHERE x."activityId" = a."id" AND x."userId" = a."assigneeId"
);

DO $$ BEGIN
  ALTER TABLE "BoardActivityAssignee"
    ADD CONSTRAINT "BoardActivityAssignee_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "BoardActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BoardActivityAssignee"
    ADD CONSTRAINT "BoardActivityAssignee_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
