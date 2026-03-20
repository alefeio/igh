import { applyClassGroupAutomaticStatusUpdates } from "@/lib/class-group-auto-status";
import { jsonErr, jsonOk } from "@/lib/http";

/**
 * Job agendado (ex.: Vercel Cron): promove turmas com data de início já passada para EM_ANDAMENTO
 * e encerra turmas EM_ANDAMENTO com endDate passado (mesma regra da listagem de turmas).
 *
 * Proteção: `CRON_SECRET` — header `Authorization: Bearer <secret>` ou query `?secret=`.
 * Na Vercel, configure CRON_SECRET no projeto; o Cron envia o Bearer automaticamente.
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

  const result = await applyClassGroupAutomaticStatusUpdates();
  return jsonOk(result);
}
