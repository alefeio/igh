import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { getSmsCampaignDetails, getSmsCampaignPreview } from "@/lib/sms";

type Ctx = { params: Promise<{ id: string }> };

/** Prévia para uma campanha existente (usa audience da campanha). */
export async function POST(_request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const campaign = await getSmsCampaignDetails(id);
  if (!campaign) return jsonErr("NOT_FOUND", "Campanha não encontrada.", 404);
  const preview = await getSmsCampaignPreview(
    campaign.audienceType,
    campaign.audienceFilters as { classGroupId?: string; courseId?: string } | null
  );
  return jsonOk({ preview });
}
