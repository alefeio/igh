-- CreateEnum
CREATE TYPE "DonatariaZone" AS ENUM ('URBANA', 'RURAL');

-- CreateEnum
CREATE TYPE "InventoryCondition" AS ENUM ('OTIMO', 'BOM', 'REGULAR', 'RUIM');

-- AlterTable InventoryItem
ALTER TABLE "InventoryItem" ADD COLUMN "brand" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "model" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "assetTag" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "serialNumber" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "responsibleName" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "condition" "InventoryCondition" NOT NULL DEFAULT 'BOM';
ALTER TABLE "InventoryItem" ADD COLUMN "unitValueCents" INTEGER;

-- AlterTable Donataria
ALTER TABLE "Donataria" ADD COLUMN "zone" "DonatariaZone" NOT NULL DEFAULT 'URBANA';

-- AlterTable Donation
ALTER TABLE "Donation" ADD COLUMN "kitsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Donation" ADD COLUMN "belongsTo" TEXT;
ALTER TABLE "Donation" ADD COLUMN "placeDateText" TEXT;
ALTER TABLE "Donation" ADD COLUMN "termNumber" INTEGER;

CREATE UNIQUE INDEX "Donation_termNumber_key" ON "Donation"("termNumber");
CREATE INDEX "Donation_termNumber_idx" ON "Donation"("termNumber");
