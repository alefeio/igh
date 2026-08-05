-- CreateTable
CREATE TABLE "WaitlistSeatOffer" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "sourceWaitlistId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "emailedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistSeatOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistSeatOffer_tokenHash_key" ON "WaitlistSeatOffer"("tokenHash");

-- CreateIndex
CREATE INDEX "WaitlistSeatOffer_status_expiresAt_idx" ON "WaitlistSeatOffer"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "WaitlistSeatOffer_classGroupId_idx" ON "WaitlistSeatOffer"("classGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistSeatOffer_studentId_classGroupId_key" ON "WaitlistSeatOffer"("studentId", "classGroupId");

-- AddForeignKey
ALTER TABLE "WaitlistSeatOffer" ADD CONSTRAINT "WaitlistSeatOffer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistSeatOffer" ADD CONSTRAINT "WaitlistSeatOffer_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistSeatOffer" ADD CONSTRAINT "WaitlistSeatOffer_sourceWaitlistId_fkey" FOREIGN KEY ("sourceWaitlistId") REFERENCES "EnrollmentWaitlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
