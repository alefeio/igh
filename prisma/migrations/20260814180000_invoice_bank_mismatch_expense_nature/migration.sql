-- AlterEnum
ALTER TYPE "UserNotificationKind" ADD VALUE 'EMPLOYEE_INVOICE_BANK_MISMATCH';

-- CreateEnum
CREATE TYPE "FinancialExpenseNature" AS ENUM ('FIXA', 'VARIAVEL');

-- AlterTable
ALTER TABLE "EmployeeInvoiceSubmission" ADD COLUMN "bankMismatch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EmployeeInvoiceSubmission" ADD COLUMN "bankMismatchDetails" TEXT;
ALTER TABLE "EmployeeInvoiceSubmission" ADD COLUMN "bankMismatchAcknowledgedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN "expenseNature" "FinancialExpenseNature";

-- CreateIndex
CREATE INDEX "FinancialEntry_kind_expenseNature_entryDate_idx" ON "FinancialEntry"("kind", "expenseNature", "entryDate");
