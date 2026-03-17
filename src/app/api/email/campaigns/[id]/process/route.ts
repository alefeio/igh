import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { processEmailCampaignBatch } from "@/lib/email-campaigns";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const batchSize = 25;
  const result = await processEmailCampaignBatch(id, batchSize);
  return jsonOk(result);
}
