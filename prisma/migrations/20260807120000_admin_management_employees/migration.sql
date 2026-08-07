-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ADMIN_MANAGER';

-- CreateEnum
CREATE TYPE "EmployeePosition" AS ENUM ('DIRETOR', 'GERENTE', 'COORDENADOR_POLO', 'PROFESSOR', 'VIGIA', 'LIMPEZA', 'MOTORISTA', 'ADMINISTRATIVO', 'OPERACIONAL');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('MEI', 'CLT', 'PRESTADOR', 'VOLUNTARIO', 'ESTAGIO');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ATIVO', 'AFASTADO', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "UniformSize" AS ENUM ('PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG');

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('CORRENTE', 'POUPANCA', 'PAGAMENTO');

-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA');

-- CreateEnum
CREATE TYPE "EmployeeDocumentType" AS ENUM ('RG', 'CPF', 'CNPJ_MEI', 'COMPROVANTE_RESIDENCIA', 'DADOS_BANCARIOS', 'CONTRATO', 'DISTRATO', 'NOTA_MENSAL', 'OUTRO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isAdminManager" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "rg" TEXT,
    "rgIssuer" TEXT,
    "birthDate" DATE,
    "email" TEXT,
    "phone" TEXT,
    "position" "EmployeePosition" NOT NULL,
    "positionLabel" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'MEI',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ATIVO',
    "admissionDate" DATE,
    "terminationDate" DATE,
    "monthlyPayCents" INTEGER,
    "uniformSize" "UniformSize",
    "meiCnpj" TEXT,
    "meiCompanyName" TEXT,
    "bankName" TEXT,
    "bankAgency" TEXT,
    "bankAccount" TEXT,
    "bankAccountType" "BankAccountType",
    "pixKeyType" "PixKeyType",
    "pixKey" TEXT,
    "cep" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "notes" TEXT,
    "poloId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "EmployeeDocumentType" NOT NULL,
    "title" TEXT,
    "referenceMonth" DATE,
    "amountCents" INTEGER,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_cpf_key" ON "Employee"("cpf");

-- CreateIndex
CREATE INDEX "Employee_deletedAt_status_idx" ON "Employee"("deletedAt", "status");

-- CreateIndex
CREATE INDEX "Employee_position_idx" ON "Employee"("position");

-- CreateIndex
CREATE INDEX "Employee_poloId_idx" ON "Employee"("poloId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_type_idx" ON "EmployeeDocument"("employeeId", "type");

-- CreateIndex
CREATE INDEX "EmployeeDocument_referenceMonth_idx" ON "EmployeeDocument"("referenceMonth");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_poloId_fkey" FOREIGN KEY ("poloId") REFERENCES "Polo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
