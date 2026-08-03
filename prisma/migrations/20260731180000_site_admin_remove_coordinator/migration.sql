-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SITE_ADMIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSiteAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Migrate Coordenador -> Administrador Pedagógico
UPDATE "User" SET role = 'ADMIN' WHERE role = 'COORDINATOR';
UPDATE "User" SET "isCoordinator" = false WHERE "isCoordinator" = true;