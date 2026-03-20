-- CreateTable
CREATE TABLE "PlatformExperienceFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "referral" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformExperienceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformExperienceFeedback_userId_idx" ON "PlatformExperienceFeedback"("userId");

-- CreateIndex
CREATE INDEX "PlatformExperienceFeedback_createdAt_idx" ON "PlatformExperienceFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "PlatformExperienceFeedback" ADD CONSTRAINT "PlatformExperienceFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
