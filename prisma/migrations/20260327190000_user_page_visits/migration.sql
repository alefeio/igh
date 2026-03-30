-- CreateTable
CREATE TABLE "UserPageVisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPageVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPageVisit_createdAt_idx" ON "UserPageVisit"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserPageVisit_userId_createdAt_idx" ON "UserPageVisit"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "UserPageVisit" ADD CONSTRAINT "UserPageVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
