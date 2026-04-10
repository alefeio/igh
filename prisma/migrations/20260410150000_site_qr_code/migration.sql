-- CreateTable
CREATE TABLE "SiteQrCode" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "link" TEXT NOT NULL,
    "centerImageUrl" TEXT,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "SiteQrCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteQrCode_createdAt_idx" ON "SiteQrCode"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "SiteQrCode" ADD CONSTRAINT "SiteQrCode_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
