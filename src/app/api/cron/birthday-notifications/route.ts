import { runBirthdayNotificationsForToday } from "@/lib/birthday-notifications";
import { jsonErr, jsonOk } from "@/lib/http";

/**
 * Job agendado (ex.: Vercel Cron): notifica alunos no dia do aniversário (calendário Brasil).
 *
 * Proteção: `CRON_SECRET` — header `Authorization: Bearer <secret>` ou query `?secret=`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const querySecret = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? querySecret;
  if (!secret || provided !== secret) {
    return jsonErr("UNAUTHORIZED", "Cron secret inválido.", 401);
  }

  const result = await runBirthdayNotificationsForToday();
  return jsonOk(result);
}
