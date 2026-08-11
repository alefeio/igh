-- AlterEnum
ALTER TYPE "UserNotificationKind" ADD VALUE 'EMPLOYEE_INVOICE_SUBMITTED';
ALTER TYPE "UserNotificationKind" ADD VALUE 'EMPLOYEE_INVOICE_REVIEWED';
ALTER TYPE "UserNotificationKind" ADD VALUE 'EMPLOYEE_PORTAL_MESSAGE';

-- CreateEnum
CREATE TYPE "EmployeeInvoiceSubmissionStatus" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA');
CREATE TYPE "EmployeePortalThreadStatus" AS ENUM ('ABERTA', 'ENCERRADA');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "EmployeeInvoiceSubmission" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "amountCents" INTEGER,
    "description" TEXT,
    "supplier" TEXT,
    "invoiceNumber" TEXT,
    "fileUrl" TEXT NOT NULL,
    "filePublicId" TEXT,
    "fileName" TEXT,
    "status" "EmployeeInvoiceSubmissionStatus" NOT NULL DEFAULT 'PENDENTE',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "financialEntryId" TEXT,
    "monthlyInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeInvoiceSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeePortalThread" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmployeePortalThreadStatus" NOT NULL DEFAULT 'ABERTA',
    "unreadByManager" BOOLEAN NOT NULL DEFAULT true,
    "unreadByEmployee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePortalThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeePortalMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "isFromManager" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePortalMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeInvoiceSubmission_employeeId_createdAt_idx" ON "EmployeeInvoiceSubmission"("employeeId", "createdAt");
CREATE INDEX "EmployeeInvoiceSubmission_status_createdAt_idx" ON "EmployeeInvoiceSubmission"("status", "createdAt");
CREATE INDEX "EmployeePortalThread_employeeId_updatedAt_idx" ON "EmployeePortalThread"("employeeId", "updatedAt");
CREATE INDEX "EmployeePortalThread_unreadByManager_idx" ON "EmployeePortalThread"("unreadByManager");
CREATE INDEX "EmployeePortalMessage_threadId_createdAt_idx" ON "EmployeePortalMessage"("threadId", "createdAt");

ALTER TABLE "EmployeeInvoiceSubmission" ADD CONSTRAINT "EmployeeInvoiceSubmission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeInvoiceSubmission" ADD CONSTRAINT "EmployeeInvoiceSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeInvoiceSubmission" ADD CONSTRAINT "EmployeeInvoiceSubmission_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeInvoiceSubmission" ADD CONSTRAINT "EmployeeInvoiceSubmission_monthlyInvoiceId_fkey" FOREIGN KEY ("monthlyInvoiceId") REFERENCES "EmployeeMonthlyInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeePortalThread" ADD CONSTRAINT "EmployeePortalThread_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePortalMessage" ADD CONSTRAINT "EmployeePortalMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmployeePortalThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePortalMessage" ADD CONSTRAINT "EmployeePortalMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
