import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  getEmailCampaignDetails,
  getEmailCampaignPreview,
} from "@/lib/email-campaigns";
import type { EmailAudienceFilters } from "@/lib/email-campaigns";

type Ctx = { params: Promise<{ id: string }> };

/** Prévia para uma campanha existente (usa audience da campanha). */
export async function POST(_request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const campaign = await getEmailCampaignDetails(id);
  if (!campaign)
    return jsonErr("NOT_FOUND", "Campanha não encontrada.", 404);
  const preview = await getEmailCampaignPreview(
    campaign.audienceType,
    campaign.audienceFilters as EmailAudienceFilters | null
  );
  return jsonOk({ preview });
}
