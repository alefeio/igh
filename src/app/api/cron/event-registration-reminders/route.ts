import { runHolidayEventRemindersForToday } from "@/lib/holiday-event-registration";
import { jsonErr, jsonOk } from "@/lib/http";

/** Cron diário (~6h BRT / 9h UTC): lembrete por e-mail no dia do evento. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const querySecret = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? querySecret;
  if (!secret || provided !== secret) {
    return jsonErr("UNAUTHORIZED", "Cron secret inválido.", 401);
  }

  const result = await runHolidayEventRemindersForToday();
  return jsonOk(result);
}
