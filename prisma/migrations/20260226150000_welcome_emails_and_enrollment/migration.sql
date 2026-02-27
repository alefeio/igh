-- AlterTable User: add mustChangePassword
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum VerificationTokenType
CREATE TYPE "VerificationTokenType" AS ENUM ('ENROLLMENT_CONFIRMATION', 'FIRST_ACCESS', 'PASSWORD_RESET');

-- CreateTable VerificationToken
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT,
    "enrollmentId" TEXT,
    "type" "VerificationTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable Enrollment
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrollmentConfirmedAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "termsVersion" TEXT,
    "confirmationMethod" TEXT,
    "confirmedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey VerificationToken -> User
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey VerificationToken -> Student
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_studentId_fkey" 
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey VerificationToken -> Enrollment (after Enrollment exists)
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_enrollmentId_fkey" 
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey Enrollment -> Student
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" 
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey Enrollment -> ClassGroup
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classGroupId_fkey" 
  FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index for token lookup by hash (we'll look by token raw and compare hash in app)
CREATE INDEX "VerificationToken_expiresAt_type_idx" ON "VerificationToken"("expiresAt", "type");
