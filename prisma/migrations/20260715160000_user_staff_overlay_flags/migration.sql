-- Flags de acesso sobreposto (papel adicional ao papel-base), espelhando isAdmin.
ALTER TABLE "User" ADD COLUMN "isCoordinator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "isPoloCoordinator" BOOLEAN NOT NULL DEFAULT false;
