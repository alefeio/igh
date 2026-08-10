-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "paymentAgreementId" TEXT;

-- CreateTable
CREATE TABLE "AnnualGoal" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "computersTarget" INTEGER NOT NULL DEFAULT 0,
    "peopleTarget" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "AnnualGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAgreement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnualGoal_year_key" ON "AnnualGoal"("year");
CREATE INDEX "AnnualGoal_year_idx" ON "AnnualGoal"("year");

CREATE UNIQUE INDEX "PaymentAgreement_name_key" ON "PaymentAgreement"("name");
CREATE INDEX "PaymentAgreement_deletedAt_isActive_sortOrder_idx" ON "PaymentAgreement"("deletedAt", "isActive", "sortOrder");

CREATE INDEX "Employee_paymentAgreementId_idx" ON "Employee"("paymentAgreementId");

-- AddForeignKey
ALTER TABLE "AnnualGoal" ADD CONSTRAINT "AnnualGoal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAgreement" ADD CONSTRAINT "PaymentAgreement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_paymentAgreementId_fkey" FOREIGN KEY ("paymentAgreementId") REFERENCES "PaymentAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
