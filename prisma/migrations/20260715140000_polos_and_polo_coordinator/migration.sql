-- Adiciona o papel POLO_COORDINATOR (coordenador de polos).
ALTER TYPE "UserRole" ADD VALUE 'POLO_COORDINATOR';

-- CreateTable
CREATE TABLE "Polo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "coordinatorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Polo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoloLocation" (
    "id" TEXT NOT NULL,
    "poloId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoloLocation_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ClassGroup" ADD COLUMN "poloLocationId" TEXT;

-- CreateIndex
CREATE INDEX "Polo_coordinatorUserId_idx" ON "Polo"("coordinatorUserId");

-- CreateIndex
CREATE INDEX "Polo_isActive_idx" ON "Polo"("isActive");

-- CreateIndex
CREATE INDEX "PoloLocation_poloId_idx" ON "PoloLocation"("poloId");

-- CreateIndex
CREATE UNIQUE INDEX "PoloLocation_poloId_name_key" ON "PoloLocation"("poloId", "name");

-- CreateIndex
CREATE INDEX "ClassGroup_poloLocationId_idx" ON "ClassGroup"("poloLocationId");

-- AddForeignKey
ALTER TABLE "Polo" ADD CONSTRAINT "Polo_coordinatorUserId_fkey" FOREIGN KEY ("coordinatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoloLocation" ADD CONSTRAINT "PoloLocation_poloId_fkey" FOREIGN KEY ("poloId") REFERENCES "Polo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_poloLocationId_fkey" FOREIGN KEY ("poloLocationId") REFERENCES "PoloLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
