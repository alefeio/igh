import { requireStaffWrite } from "@/lib/auth";
import {
  getOrCreateHolidayCalendarBanner,
  mapHolidayCalendarBannerAdmin,
} from "@/lib/holiday-calendar-banner";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { holidayCalendarBannerSchema } from "@/lib/validators/holidays";

export async function GET() {
  await requireStaffWrite();
  const row = await getOrCreateHolidayCalendarBanner();
  return jsonOk({ banner: mapHolidayCalendarBannerAdmin(row) });
}

export async function PATCH(request: Request) {
  await requireStaffWrite();
  const body = await request.json().catch(() => null);
  const parsed = holidayCalendarBannerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  if (parsed.data.isActive) {
    const existing = await getOrCreateHolidayCalendarBanner();
    const nextTitle = parsed.data.title !== undefined ? parsed.data.title?.trim() : existing.title?.trim();
    if (!nextTitle) {
      return jsonErr("VALIDATION_ERROR", "Informe um título para ativar o banner.", 400);
    }
  }

  const row = await getOrCreateHolidayCalendarBanner();
  const updated = await prisma.holidayCalendarBanner.update({
    where: { id: row.id },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title?.trim() || null }),
      ...(parsed.data.subtitle !== undefined && { subtitle: parsed.data.subtitle?.trim() || null }),
      ...(parsed.data.ctaLabel !== undefined && { ctaLabel: parsed.data.ctaLabel?.trim() || null }),
      ...(parsed.data.ctaHref !== undefined && { ctaHref: parsed.data.ctaHref?.trim() || null }),
      ...(parsed.data.imageUrl !== undefined && { imageUrl: parsed.data.imageUrl?.trim() || null }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
    },
  });

  return jsonOk({ banner: mapHolidayCalendarBannerAdmin(updated) });
}
