import { revalidateTag } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { isMarketingCampaignActiveInWindow } from "@/lib/marketing-campaign-active";

const MOTHERS_CAMPAIGN_SLUG = "dia-das-maes-2026";
const MAX_COMMENT = 4000;

const bodySchema = z.object({
  name: z.string().min(2, "Informe seu nome.").max(200, "Nome muito longo."),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  ratingStars: z.number().int().min(1).max(10),
  comment: z.string().min(10, "Escreva uma mensagem um pouco maior.").max(MAX_COMMENT, "Mensagem muito longa."),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const campaign = await prisma.marketingCampaign.findUnique({
    where: { slug: MOTHERS_CAMPAIGN_SLUG },
    select: { id: true, isActive: true, startsAt: true, endsAt: true },
  });
  if (!campaign) return jsonErr("NOT_FOUND", "Campanha não encontrada.", 404);
  if (!isMarketingCampaignActiveInWindow(campaign)) {
    return jsonErr("FORBIDDEN", "Campanha encerrada ou indisponível.", 403);
  }

  const name = parsed.data.name.trim();
  const email = parsed.data.email?.trim() ? parsed.data.email.trim() : null;
  const comment = parsed.data.comment.trim().slice(0, MAX_COMMENT);

  const row = await prisma.marketingCampaignGuestResponse.create({
    data: {
      campaignId: campaign.id,
      name,
      email,
      ratingStars: parsed.data.ratingStars,
      comment,
    },
    select: { id: true, createdAt: true },
  });

  revalidateTag("public-mothers-day-messages-v2", "max");
  return jsonOk({ id: row.id, createdAt: row.createdAt.toISOString() }, { status: 201 });
}

