-- CreateTable
CREATE TABLE "HolidayCalendarBanner" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "title" TEXT,
    "subtitle" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayCalendarBanner_pkey" PRIMARY KEY ("id")
);
