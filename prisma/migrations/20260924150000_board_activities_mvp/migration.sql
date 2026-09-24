-- Quadro de Atividades MVP (aditivo)

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canCreateBoardTasks" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BoardActivityStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BoardActivityEventType" AS ENUM (
    'CREATED',
    'STATUS_CHANGED',
    'ASSIGNEE_CHANGED',
    'PLANNED_PERIOD_CHANGED',
    'ARCHIVED',
    'ADMIN_REASSIGNED',
    'REOPENED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum UserNotificationKind
ALTER TYPE "UserNotificationKind" ADD VALUE IF NOT EXISTS 'BOARD_ACTIVITY_ASSIGNED';
ALTER TYPE "UserNotificationKind" ADD VALUE IF NOT EXISTS 'BOARD_ACTIVITY_COMMENT';

-- CreateTable BoardActivity
CREATE TABLE IF NOT EXISTS "BoardActivity" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "BoardActivityStatus" NOT NULL DEFAULT 'PLANNED',
  "creatorId" TEXT NOT NULL,
  "assigneeId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "plannedStartAt" TIMESTAMP(3) NOT NULL,
  "plannedEndAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BoardActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BoardActivityComment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "BoardActivityComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BoardActivityReaction" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoardActivityReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BoardActivityEvent" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "type" "BoardActivityEventType" NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoardActivityEvent_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (idempotent-ish)
DO $$ BEGIN
  ALTER TABLE "BoardActivity" ADD CONSTRAINT "BoardActivity_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BoardActivity" ADD CONSTRAINT "BoardActivity_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BoardActivity" ADD CONSTRAINT "BoardActivity_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "PoloLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BoardActivityComment" ADD CONSTRAINT "BoardActivityComment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "BoardActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BoardActivityComment" ADD CONSTRAINT "BoardActivityComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BoardActivityReaction" ADD CONSTRAINT "BoardActivityReaction_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "BoardActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BoardActivityReaction" ADD CONSTRAINT "BoardActivityReaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BoardActivityEvent" ADD CONSTRAINT "BoardActivityEvent_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "BoardActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BoardActivityEvent" ADD CONSTRAINT "BoardActivityEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "BoardActivityReaction_taskId_userId_emoji_key"
  ON "BoardActivityReaction"("taskId", "userId", "emoji");

CREATE INDEX IF NOT EXISTS "BoardActivity_unitId_status_archivedAt_idx"
  ON "BoardActivity"("unitId", "status", "archivedAt");
CREATE INDEX IF NOT EXISTS "BoardActivity_assigneeId_idx" ON "BoardActivity"("assigneeId");
CREATE INDEX IF NOT EXISTS "BoardActivity_creatorId_idx" ON "BoardActivity"("creatorId");
CREATE INDEX IF NOT EXISTS "BoardActivity_plannedStartAt_plannedEndAt_idx"
  ON "BoardActivity"("plannedStartAt", "plannedEndAt");
CREATE INDEX IF NOT EXISTS "BoardActivity_startedAt_completedAt_idx"
  ON "BoardActivity"("startedAt", "completedAt");
CREATE INDEX IF NOT EXISTS "BoardActivityComment_taskId_createdAt_idx"
  ON "BoardActivityComment"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "BoardActivityComment_authorId_idx" ON "BoardActivityComment"("authorId");
CREATE INDEX IF NOT EXISTS "BoardActivityReaction_taskId_idx" ON "BoardActivityReaction"("taskId");
CREATE INDEX IF NOT EXISTS "BoardActivityEvent_taskId_createdAt_idx"
  ON "BoardActivityEvent"("taskId", "createdAt");
