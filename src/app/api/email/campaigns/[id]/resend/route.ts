import type { EmailRecipientStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  processEmailCampaignBatch,
  requeueFailedEmailCampaignRecipients,
} from "@/lib/email-campaigns";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;

  const body = (await request.json().catch(() => null)) as { onlyFailed?: boolean } | null;
  const onlyFailed = Boolean(body && typeof body === "object" && body.onlyFailed === true);

  const statuses: EmailRecipientStatus[] | undefined = onlyFailed ? ["FAILED"] : undefined;

  const requeued = await requeueFailedEmailCampaignRecipients(
    id,
    statuses ? { statuses } : undefined
  );
  if (!requeued) {
    return jsonErr(
      "NOT_FOUND",
      "Campanha não encontrada ou não pode ser reenviada.",
      404
    );
  }
  if (requeued.updatedCount === 0) {
    return jsonErr(
      "NO_RECIPIENTS_TO_REQUEUE",
      onlyFailed
        ? "Nenhum destinatário com status Falha para reenviar."
        : "Nenhum destinatário com falha, bounce ou reclamação para reenviar.",
      400
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

