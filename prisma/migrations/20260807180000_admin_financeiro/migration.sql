-- CreateEnum
CREATE TYPE "FinancialEntryKind" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "FinancialPaymentMethod" AS ENUM ('PIX', 'DINHEIRO', 'TRANSFERENCIA', 'BOLETO', 'CARTAO', 'CHEQUE', 'OUTRO');

-- CreateTable
CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FinancialEntryKind" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "kind" "FinancialEntryKind" NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "entryDate" DATE NOT NULL,
    "categoryId" TEXT,
    "paymentMethod" "FinancialPaymentMethod" NOT NULL DEFAULT 'PIX',
    "poloId" TEXT,
    "responsibleUserId" TEXT,
    "responsibleName" TEXT,
    "invoiceNumber" TEXT,
    "supplier" TEXT,
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "attachmentPublicId" TEXT,
    "attachmentFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialCategory_kind_isActive_idx" ON "FinancialCategory"("kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_name_kind_key" ON "FinancialCategory"("name", "kind");

-- CreateIndex
CREATE INDEX "FinancialEntry_deletedAt_entryDate_idx" ON "FinancialEntry"("deletedAt", "entryDate");

-- CreateIndex
CREATE INDEX "FinancialEntry_kind_entryDate_idx" ON "FinancialEntry"("kind", "entryDate");

-- CreateIndex
CREATE INDEX "FinancialEntry_categoryId_idx" ON "FinancialEntry"("categoryId");

-- CreateIndex
CREATE INDEX "FinancialEntry_poloId_idx" ON "FinancialEntry"("poloId");

-- AddForeignKey
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_poloId_fkey" FOREIGN KEY ("poloId") REFERENCES "Polo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed categorias iniciais (idempotente por unique name+kind)
INSERT INTO "FinancialCategory" ("id", "name", "kind", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Doação recebida', 'ENTRADA', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Convênio / parceria', 'ENTRADA', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Outras entradas', 'ENTRADA', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Nota MEI / colaborador', 'SAIDA', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Material / almoxarifado', 'SAIDA', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Serviços', 'SAIDA', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Despesas operacionais', 'SAIDA', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Outras saídas', 'SAIDA', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name", "kind") DO NOTHING;
