import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  processEmailCampaignBatch,
  requeueEmailCampaignRecipient,
} from "@/lib/email-campaigns";

type Ctx = { params: Promise<{ id: string; recipientId: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id: campaignId, recipientId } = await ctx.params;

  const result = await requeueEmailCampaignRecipient(campaignId, recipientId);
  if (!result) {
    return jsonErr(
      "NOT_FOUND",
      "Destinatário/campanha não encontrados ou campanha cancelada.",
      404
    );
  }
  if (result.blocked) {
    return jsonErr(
      "FORBIDDEN",
      "Não é possível reenviar para destinatário com e-mail inválido.",
      403
    );
  }

  const batch = await processEmailCampaignBatch(campaignId, 25);
  return jsonOk({
    processed: batch.processed,
    remaining: batch.remaining,
    done: batch.done,
  });
}

