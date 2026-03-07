-- CreateTable
CREATE TABLE "SiteContatoPage" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "headerImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContatoPage_pkey" PRIMARY KEY ("id")
);
