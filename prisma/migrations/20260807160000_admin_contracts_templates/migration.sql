-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "shoeSize" TEXT;

-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('CONTRATO', 'DISTRATO', 'TERMO_DOACAO');

-- CreateEnum
CREATE TYPE "EmployeeContractKind" AS ENUM ('CONTRATO', 'DISTRATO');

-- CreateEnum
CREATE TYPE "EmployeeContractStatus" AS ENUM ('RASCUNHO', 'ATIVO', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EmployeeMonthlyInvoiceStatus" AS ENUM ('PENDENTE', 'ENTREGUE', 'ATRASADA');

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "title" TEXT NOT NULL,
    "contentRich" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeContract" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT,
    "kind" "EmployeeContractKind" NOT NULL DEFAULT 'CONTRATO',
    "parentContractId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "monthlyValueCents" INTEGER,
    "description" TEXT,
    "status" "EmployeeContractStatus" NOT NULL DEFAULT 'RASCUNHO',
    "renderedHtml" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "pdfPublicId" TEXT,
    "signedPdfUrl" TEXT,
    "signedPdfPublicId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMonthlyInvoice" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "amountCents" INTEGER,
    "status" "EmployeeMonthlyInvoiceStatus" NOT NULL DEFAULT 'PENDENTE',
    "issuedAt" TIMESTAMP(3),
    "notes" TEXT,
    "pdfUrl" TEXT,
    "pdfPublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeMonthlyInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentTemplate_type_isActive_idx" ON "DocumentTemplate"("type", "isActive");

-- CreateIndex
CREATE INDEX "EmployeeContract_employeeId_kind_deletedAt_idx" ON "EmployeeContract"("employeeId", "kind", "deletedAt");

-- CreateIndex
CREATE INDEX "EmployeeContract_status_idx" ON "EmployeeContract"("status");

-- CreateIndex
CREATE INDEX "EmployeeContract_parentContractId_idx" ON "EmployeeContract"("parentContractId");

-- CreateIndex
CREATE INDEX "EmployeeMonthlyInvoice_referenceMonth_status_idx" ON "EmployeeMonthlyInvoice"("referenceMonth", "status");

-- CreateIndex
CREATE INDEX "EmployeeMonthlyInvoice_deletedAt_idx" ON "EmployeeMonthlyInvoice"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMonthlyInvoice_employeeId_referenceMonth_key" ON "EmployeeMonthlyInvoice"("employeeId", "referenceMonth");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeContract" ADD CONSTRAINT "EmployeeContract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeContract" ADD CONSTRAINT "EmployeeContract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeContract" ADD CONSTRAINT "EmployeeContract_parentContractId_fkey" FOREIGN KEY ("parentContractId") REFERENCES "EmployeeContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeContract" ADD CONSTRAINT "EmployeeContract_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlyInvoice" ADD CONSTRAINT "EmployeeMonthlyInvoice_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMonthlyInvoice" ADD CONSTRAINT "EmployeeMonthlyInvoice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
