-- CreateTable
CREATE TABLE "NextCycleInterestContact" (
    "id" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "contactedByUserId" TEXT NOT NULL,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gotResponse" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "NextCycleInterestContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NextCycleInterestContact_interestId_contactedAt_idx" ON "NextCycleInterestContact"("interestId", "contactedAt" DESC);

-- CreateIndex
CREATE INDEX "NextCycleInterestContact_contactedByUserId_idx" ON "NextCycleInterestContact"("contactedByUserId");

-- AddForeignKey
ALTER TABLE "NextCycleInterestContact" ADD CONSTRAINT "NextCycleInterestContact_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "NextCycleInterest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NextCycleInterestContact" ADD CONSTRAINT "NextCycleInterestContact_contactedByUserId_fkey" FOREIGN KEY ("contactedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
