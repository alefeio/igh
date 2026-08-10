-- CreateEnum
CREATE TYPE "FundingChannel" AS ENUM ('CONVENIO', 'POR_FORA');
CREATE TYPE "PayrollMonthStatus" AS ENUM ('ABERTA', 'FECHADA');
CREATE TYPE "PayrollPaymentStatus" AS ENUM ('PENDENTE', 'PAGO');
CREATE TYPE "MealTicketStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- AlterTable Employee
ALTER TABLE "Employee" ADD COLUMN "fundingChannel" "FundingChannel" NOT NULL DEFAULT 'CONVENIO';
ALTER TABLE "Employee" ADD COLUMN "fundingContractRef" TEXT;
ALTER TABLE "Employee" ADD COLUMN "offBooksPayCents" INTEGER;

CREATE INDEX "Employee_fundingChannel_idx" ON "Employee"("fundingChannel");

-- CreateTable PayrollMonth
CREATE TABLE "PayrollMonth" (
    "id" TEXT NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "status" "PayrollMonthStatus" NOT NULL DEFAULT 'ABERTA',
    "responsibleName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "PayrollMonth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollMonth_referenceMonth_key" ON "PayrollMonth"("referenceMonth");
CREATE INDEX "PayrollMonth_status_referenceMonth_idx" ON "PayrollMonth"("status", "referenceMonth");

ALTER TABLE "PayrollMonth" ADD CONSTRAINT "PayrollMonth_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable PayrollLine
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "payrollMonthId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "positionLabel" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "documentId" TEXT,
    "bankSummary" TEXT,
    "fundingChannel" "FundingChannel" NOT NULL DEFAULT 'CONVENIO',
    "fundingContractRef" TEXT,
    "paymentAgreementName" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "offBooksPayCents" INTEGER NOT NULL DEFAULT 0,
    "observation" TEXT,
    "paymentStatus" "PayrollPaymentStatus" NOT NULL DEFAULT 'PENDENTE',
    "paidAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollLine_payrollMonthId_employeeId_key" ON "PayrollLine"("payrollMonthId", "employeeId");
CREATE INDEX "PayrollLine_payrollMonthId_paymentStatus_idx" ON "PayrollLine"("payrollMonthId", "paymentStatus");
CREATE INDEX "PayrollLine_employeeId_idx" ON "PayrollLine"("employeeId");

ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollMonthId_fkey" FOREIGN KEY ("payrollMonthId") REFERENCES "PayrollMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable MealTicketMonth
CREATE TABLE "MealTicketMonth" (
    "id" TEXT NOT NULL,
    "payrollMonthId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "MealTicketMonth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MealTicketMonth_payrollMonthId_key" ON "MealTicketMonth"("payrollMonthId");

ALTER TABLE "MealTicketMonth" ADD CONSTRAINT "MealTicketMonth_payrollMonthId_fkey" FOREIGN KEY ("payrollMonthId") REFERENCES "PayrollMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealTicketMonth" ADD CONSTRAINT "MealTicketMonth_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable MealTicketLine
CREATE TABLE "MealTicketLine" (
    "id" TEXT NOT NULL,
    "mealTicketMonthId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "positionLabel" TEXT NOT NULL,
    "status" "MealTicketStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealTicketLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MealTicketLine_mealTicketMonthId_employeeId_key" ON "MealTicketLine"("mealTicketMonthId", "employeeId");
CREATE INDEX "MealTicketLine_mealTicketMonthId_status_idx" ON "MealTicketLine"("mealTicketMonthId", "status");

ALTER TABLE "MealTicketLine" ADD CONSTRAINT "MealTicketLine_mealTicketMonthId_fkey" FOREIGN KEY ("mealTicketMonthId") REFERENCES "MealTicketMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealTicketLine" ADD CONSTRAINT "MealTicketLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
