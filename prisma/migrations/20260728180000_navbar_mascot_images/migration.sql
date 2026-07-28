-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "navbarMascotEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "navbarMascotUrl" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "navbarMascotScrolledUrl" TEXT;
