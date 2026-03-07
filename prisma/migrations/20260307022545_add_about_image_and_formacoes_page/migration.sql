-- AlterTable
ALTER TABLE "SiteAboutPage" ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "SiteFormacoesPage" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "headerImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteFormacoesPage_pkey" PRIMARY KEY ("id")
);
