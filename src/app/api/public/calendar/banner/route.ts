import { getActiveHolidayCalendarBanner } from "@/lib/holiday-calendar-banner";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const banner = await getActiveHolidayCalendarBanner();
  return jsonOk({ banner });
}
