-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "completedTutorialKeys" TEXT[] NOT NULL DEFAULT '{}';
