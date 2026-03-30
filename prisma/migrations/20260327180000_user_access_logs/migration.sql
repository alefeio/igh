-- CreateTable
CREATE TABLE "UserAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "loginKind" TEXT NOT NULL DEFAULT 'EMAIL',

    CONSTRAINT "UserAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAccessLog_createdAt_idx" ON "UserAccessLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserAccessLog_userId_createdAt_idx" ON "UserAccessLog"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "UserAccessLog" ADD CONSTRAINT "UserAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
