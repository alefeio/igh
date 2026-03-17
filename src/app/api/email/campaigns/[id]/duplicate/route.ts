import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { duplicateEmailCampaign } from "@/lib/email-campaigns";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const campaign = await duplicateEmailCampaign(id, user.id);
  if (!campaign)
    return jsonErr("NOT_FOUND", "Campanha não encontrada.", 404);
  return jsonOk({ campaign });
}
