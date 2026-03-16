import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { processSmsCampaignBatch } from "@/lib/sms";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Processa um lote da campanha (serverless-safe).
 * Pode ser chamado por cron ou após confirm com sendImmediately.
 */
export async function POST(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const batchSize = typeof body?.batchSize === "number" ? Math.min(50, Math.max(1, body.batchSize)) : 20;
  const result = await processSmsCampaignBatch(id, batchSize);
  return jsonOk(result);
}
