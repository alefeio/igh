-- CreateEnum
CREATE TYPE "TechnicalVisitItemStatus" AS ENUM ('OK', 'PENDENTE', 'NAO_APLICAVEL');

-- CreateEnum
CREATE TYPE "TechnicalVisitClassification" AS ENUM ('APTA', 'APTA_COM_PENDENCIAS', 'INAPTA');

-- CreateTable
CREATE TABLE "EquipmentCatalogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantityPerKit" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EquipmentCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalVisit" (
    "id" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "municipality" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PA',
    "address" TEXT,
    "localContact" TEXT,
    "visitedAt" DATE NOT NULL,
    "visitors" TEXT,
    "metaStudents" INTEGER,
    "metaClassGroups" INTEGER,
    "metaStudentsPerClass" INTEGER,
    "classDuration" TEXT,
    "classesPerWeek" TEXT,
    "classDays" TEXT,
    "pedagogicalPlan" TEXT,
    "structuralStandards" TEXT,
    "finalClassification" "TechnicalVisitClassification" NOT NULL DEFAULT 'APTA_COM_PENDENCIAS',
    "finalNotes" TEXT,
    "donatariaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TechnicalVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalVisitChecklistItem" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "status" "TechnicalVisitItemStatus" NOT NULL DEFAULT 'PENDENTE',
    "observation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TechnicalVisitChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentCatalogItem_name_key" ON "EquipmentCatalogItem"("name");
CREATE INDEX "EquipmentCatalogItem_deletedAt_isActive_sortOrder_idx" ON "EquipmentCatalogItem"("deletedAt", "isActive", "sortOrder");

CREATE INDEX "TechnicalVisit_visitedAt_idx" ON "TechnicalVisit"("visitedAt");
CREATE INDEX "TechnicalVisit_municipality_idx" ON "TechnicalVisit"("municipality");
CREATE INDEX "TechnicalVisit_finalClassification_deletedAt_idx" ON "TechnicalVisit"("finalClassification", "deletedAt");
CREATE INDEX "TechnicalVisit_donatariaId_idx" ON "TechnicalVisit"("donatariaId");

CREATE INDEX "TechnicalVisitChecklistItem_visitId_sortOrder_idx" ON "TechnicalVisitChecklistItem"("visitId", "sortOrder");
CREATE UNIQUE INDEX "TechnicalVisitChecklistItem_visitId_key_key" ON "TechnicalVisitChecklistItem"("visitId", "key");

-- AddForeignKey
ALTER TABLE "EquipmentCatalogItem" ADD CONSTRAINT "EquipmentCatalogItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TechnicalVisit" ADD CONSTRAINT "TechnicalVisit_donatariaId_fkey" FOREIGN KEY ("donatariaId") REFERENCES "Donataria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TechnicalVisit" ADD CONSTRAINT "TechnicalVisit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TechnicalVisitChecklistItem" ADD CONSTRAINT "TechnicalVisitChecklistItem_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "TechnicalVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
