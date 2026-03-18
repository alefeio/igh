import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  processEmailCampaignBatch,
  requeueFailedEmailCampaignRecipients,
} from "@/lib/email-campaigns";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const requeued = await requeueFailedEmailCampaignRecipients(id);
  if (!requeued) {
    return jsonErr(
      "NOT_FOUND",
      "Campanha não encontrada ou não pode ser reenviada.",
      404
    );
  }
  // já processa um lote para iniciar o reenvio imediatamente
  const batch = await processEmailCampaignBatch(id, 25);
  return jsonOk({
    requeued: requeued.updatedCount,
    processed: batch.processed,
    remaining: batch.remaining,
    done: batch.done,
  });
}

