-- CreateTable
CREATE TABLE "SiteAboutPage" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAboutPage_pkey" PRIMARY KEY ("id")
);
