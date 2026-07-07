import "server-only";

import { prisma } from "@/lib/prisma";

export const HOLIDAY_CALENDAR_BANNER_ID = "singleton";

export type HolidayCalendarBannerPublic = {
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
};

export type HolidayCalendarBannerAdmin = HolidayCalendarBannerPublic & {
  isActive: boolean;
  updatedAt: string;
};

export async function getOrCreateHolidayCalendarBanner() {
  return prisma.holidayCalendarBanner.upsert({
    where: { id: HOLIDAY_CALENDAR_BANNER_ID },
    create: { id: HOLIDAY_CALENDAR_BANNER_ID },
    update: {},
  });
}

export async function getActiveHolidayCalendarBanner(): Promise<HolidayCalendarBannerPublic | null> {
  const row = await prisma.holidayCalendarBanner.findUnique({
    where: { id: HOLIDAY_CALENDAR_BANNER_ID },
  });
  if (!row?.isActive || !row.title?.trim()) return null;
  return {
    title: row.title.trim(),
    subtitle: row.subtitle?.trim() || null,
    ctaLabel: row.ctaLabel?.trim() || null,
    ctaHref: row.ctaHref?.trim() || null,
    imageUrl: row.imageUrl?.trim() || null,
  };
}

export function mapHolidayCalendarBannerAdmin(row: {
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  isActive: boolean;
  updatedAt: Date;
}): HolidayCalendarBannerAdmin {
  return {
    title: row.title?.trim() ?? "",
    subtitle: row.subtitle?.trim() || null,
    ctaLabel: row.ctaLabel?.trim() || null,
    ctaHref: row.ctaHref?.trim() || null,
    imageUrl: row.imageUrl?.trim() || null,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}
