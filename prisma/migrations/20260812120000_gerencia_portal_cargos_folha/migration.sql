-- AlterEnum
ALTER TYPE "UserNotificationKind" ADD VALUE 'EMPLOYEE_CLEANING_REPORT';
ALTER TYPE "UserNotificationKind" ADD VALUE 'EMPLOYEE_DRIVER_LOG';

-- CreateEnum
CREATE TYPE "EmployeePortalReviewStatus" AS ENUM ('PENDENTE', 'VISTO');
CREATE TYPE "CleaningMaterialKind" AS ENUM ('DISPONIVEL', 'FALTANDO');
CREATE TYPE "DriverLogKind" AS ENUM ('QUILOMETRAGEM', 'NOTA_SERVICO', 'OCORRENCIA');

-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN "financialEntryId" TEXT;

-- CreateTable
CREATE TABLE "EmployeeCleaningReport" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "notes" TEXT,
    "status" "EmployeePortalReviewStatus" NOT NULL DEFAULT 'PENDENTE',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCleaningReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeCleaningReportLine" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "kind" "CleaningMaterialKind" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "EmployeeCleaningReportLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeDriverLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "DriverLogKind" NOT NULL,
    "occurredAt" DATE NOT NULL,
    "odometerKm" INTEGER,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER,
    "supplier" TEXT,
    "invoiceNumber" TEXT,
    "fileUrl" TEXT,
    "filePublicId" TEXT,
    "fileName" TEXT,
    "status" "EmployeePortalReviewStatus" NOT NULL DEFAULT 'PENDENTE',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "financialEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDriverLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeCleaningReport_employeeId_createdAt_idx" ON "EmployeeCleaningReport"("employeeId", "createdAt");
CREATE INDEX "EmployeeCleaningReport_status_createdAt_idx" ON "EmployeeCleaningReport"("status", "createdAt");
CREATE INDEX "EmployeeCleaningReportLine_reportId_idx" ON "EmployeeCleaningReportLine"("reportId");
CREATE INDEX "EmployeeCleaningReportLine_inventoryItemId_idx" ON "EmployeeCleaningReportLine"("inventoryItemId");
CREATE INDEX "EmployeeDriverLog_employeeId_createdAt_idx" ON "EmployeeDriverLog"("employeeId", "createdAt");
CREATE INDEX "EmployeeDriverLog_kind_createdAt_idx" ON "EmployeeDriverLog"("kind", "createdAt");
CREATE INDEX "EmployeeDriverLog_status_createdAt_idx" ON "EmployeeDriverLog"("status", "createdAt");

ALTER TABLE "EmployeeCleaningReport" ADD CONSTRAINT "EmployeeCleaningReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeCleaningReport" ADD CONSTRAINT "EmployeeCleaningReport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeCleaningReportLine" ADD CONSTRAINT "EmployeeCleaningReportLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EmployeeCleaningReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeCleaningReportLine" ADD CONSTRAINT "EmployeeCleaningReportLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeDriverLog" ADD CONSTRAINT "EmployeeDriverLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeDriverLog" ADD CONSTRAINT "EmployeeDriverLog_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeDriverLog" ADD CONSTRAINT "EmployeeDriverLog_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
