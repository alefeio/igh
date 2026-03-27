-- CreateTable
CREATE TABLE "OnboardingGuide" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "contentRich" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "OnboardingGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingUserVisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OnboardingUserVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingGuide_role_key" ON "OnboardingGuide"("role");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingUserVisit_userId_key" ON "OnboardingUserVisit"("userId");

-- CreateIndex
CREATE INDEX "OnboardingUserVisit_lastSeenAt_idx" ON "OnboardingUserVisit"("lastSeenAt");

-- AddForeignKey
ALTER TABLE "OnboardingGuide" ADD CONSTRAINT "OnboardingGuide_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingUserVisit" ADD CONSTRAINT "OnboardingUserVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
