-- Indicação de alunos: código por usuário + vínculo com marcos.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByUserId" TEXT;

CREATE TABLE IF NOT EXISTS "UserReferralCode" (
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserReferralCode_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserReferralCode_code_key" ON "UserReferralCode"("code");
CREATE INDEX IF NOT EXISTS "UserReferralCode_code_idx" ON "UserReferralCode"("code");

CREATE TABLE IF NOT EXISTS "StudentReferral" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredStudentId" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstAttendanceAt" TIMESTAMP(3),
    "certifiedAt" TIMESTAMP(3),
    CONSTRAINT "StudentReferral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentReferral_referredStudentId_key" ON "StudentReferral"("referredStudentId");
CREATE INDEX IF NOT EXISTS "StudentReferral_referrerUserId_registeredAt_idx" ON "StudentReferral"("referrerUserId", "registeredAt" DESC);

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "User_referredByUserId_idx" ON "User"("referredByUserId");

DO $$ BEGIN
  ALTER TABLE "UserReferralCode" ADD CONSTRAINT "UserReferralCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudentReferral" ADD CONSTRAINT "StudentReferral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudentReferral" ADD CONSTRAINT "StudentReferral_referredStudentId_fkey" FOREIGN KEY ("referredStudentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
