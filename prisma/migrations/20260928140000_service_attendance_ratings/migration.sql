-- Avaliação pública do atendimento (aditivo)

DO $$ BEGIN
  CREATE TYPE "ServiceChannel" AS ENUM ('PRESENCIAL', 'WHATSAPP', 'TELEFONE', 'EMAIL', 'SITE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ServiceAttendanceRating" (
  "id" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "channel" "ServiceChannel" NOT NULL,
  "comment" TEXT,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceAttendanceRating_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceAttendanceRating_createdAt_idx" ON "ServiceAttendanceRating"("createdAt");
CREATE INDEX IF NOT EXISTS "ServiceAttendanceRating_score_idx" ON "ServiceAttendanceRating"("score");
CREATE INDEX IF NOT EXISTS "ServiceAttendanceRating_userId_idx" ON "ServiceAttendanceRating"("userId");

DO $$ BEGIN
  ALTER TABLE "ServiceAttendanceRating"
    ADD CONSTRAINT "ServiceAttendanceRating_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
