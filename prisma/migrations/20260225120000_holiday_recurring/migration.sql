-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN "recurring" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex
DROP INDEX "Holiday_date_key";
