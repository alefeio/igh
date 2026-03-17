import { jsonErr, jsonOk } from "@/lib/http";
import {
  startDueScheduledEmailCampaigns,
  processEmailCampaignBatch,
} from "@/lib/email-campaigns";

/**
 * Endpoint para Vercel Cron (ou outro job): inicia campanhas de e-mail agendadas e processa um lote de cada campanha em PROCESSING.
 * Protegido por EMAIL_CRON_SECRET (header Authorization: Bearer <secret> ou query ?secret=).
 */
export async function GET(request: Request) {
  const secret = process.env.EMAIL_CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const querySecret = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? querySecret;
  if (!secret || provided !== secret) {
    return jsonErr("UNAUTHORIZED", "Cron secret inválido.", 401);
  }

  const started = await startDueScheduledEmailCampaigns();
  const results: {
    campaignId: string;
    processed: number;
    remaining: number;
  }[] = [];
  for (const campaignId of started) {
    const r = await processEmailCampaignBatch(campaignId, 25);
    results.push({
      campaignId: r.campaignId,
      processed: r.processed,
      remaining: r.remaining,
    });
  }
  const processingIds = await (async () => {
    const { prisma } = await import("@/lib/prisma");
    const list = await prisma.emailCampaign.findMany({
      where: { status: "PROCESSING" },
      select: { id: true },
    });
    return list.map((c) => c.id);
  })();
  for (const campaignId of processingIds) {
    if (started.includes(campaignId)) continue;
    const r = await processEmailCampaignBatch(campaignId, 25);
    results.push({
      campaignId: r.campaignId,
      processed: r.processed,
      remaining: r.remaining,
    });
  }

  return jsonOk({ started, results });
}
