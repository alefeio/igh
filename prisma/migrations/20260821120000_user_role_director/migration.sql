-- AlterEnum: perfil Diretor (dashboard executivo + leitura da Gerência)
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'DIRECTOR';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
