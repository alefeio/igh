-- CreateEnum
CREATE TYPE "FinancialPaymentStatus" AS ENUM ('EM_ABERTO', 'PAGO', 'PENDENTE');

-- AlterEnum
ALTER TYPE "UserNotificationKind" ADD VALUE 'FINANCIAL_DUE_REMINDER';

-- AlterTable: lançamentos legados do fluxo de caixa entram como pagos (não gerar alerta em massa)
ALTER TABLE "FinancialEntry" ADD COLUMN "paymentStatus" "FinancialPaymentStatus" NOT NULL DEFAULT 'PAGO';
ALTER TABLE "FinancialEntry" ADD COLUMN "paidAt" TIMESTAMP(3);

UPDATE "FinancialEntry" SET "paidAt" = "entryDate" WHERE "paidAt" IS NULL;

CREATE INDEX "FinancialEntry_paymentStatus_entryDate_idx" ON "FinancialEntry"("paymentStatus", "entryDate");

-- Novos lançamentos (via Prisma) usam EM_ABERTO; o DEFAULT PAGO acima só serviu o backfill.
ALTER TABLE "FinancialEntry" ALTER COLUMN "paymentStatus" SET DEFAULT 'EM_ABERTO';
