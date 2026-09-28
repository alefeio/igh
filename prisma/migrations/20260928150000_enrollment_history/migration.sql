-- Histórico da matrícula (justificativa, cancelamento e busca ativa)

DO $$ BEGIN
  CREATE TYPE "EnrollmentHistoryKind" AS ENUM ('JUSTIFICATIVA', 'CANCELAMENTO', 'QUARTA_FALTA', 'BUSCA_ATIVA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "EnrollmentHistoryEntry" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "kind" "EnrollmentHistoryKind" NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EnrollmentHistoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EnrollmentHistoryEntry_enrollmentId_createdAt_idx"
  ON "EnrollmentHistoryEntry"("enrollmentId", "createdAt");
CREATE INDEX IF NOT EXISTS "EnrollmentHistoryEntry_authorId_idx"
  ON "EnrollmentHistoryEntry"("authorId");

DO $$ BEGIN
  ALTER TABLE "EnrollmentHistoryEntry"
    ADD CONSTRAINT "EnrollmentHistoryEntry_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EnrollmentHistoryEntry"
    ADD CONSTRAINT "EnrollmentHistoryEntry_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
