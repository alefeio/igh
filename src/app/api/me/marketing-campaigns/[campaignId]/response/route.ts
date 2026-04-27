import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

type RouteCtx = { params: Promise<{ campaignId: string }> };

const MAX_COMMENT = 4000;

export async function POST(request: Request, ctx: RouteCtx) {
  const user = await requireRole("STUDENT");
  const { campaignId } = await ctx.params;

  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, isActive: true, startsAt: true, endsAt: true },
  });
  if (!campaign) return jsonErr("NOT_FOUND", "Campanha não encontrada.", 404);
  if (!campaign.isActive) return jsonErr("FORBIDDEN", "Campanha inativa.", 403);
  const now = new Date();
  if (campaign.startsAt && now < campaign.startsAt) return jsonErr("FORBIDDEN", "Campanha ainda não iniciou.", 403);
  if (campaign.endsAt && now > campaign.endsAt) return jsonErr("FORBIDDEN", "Campanha encerrada.", 403);

  const body = await request.json().catch(() => null);
  const ratingStars = typeof body?.ratingStars === "number" ? body.ratingStars : parseInt(String(body?.ratingStars ?? ""), 10);
  if (!Number.isFinite(ratingStars) || ratingStars < 1 || ratingStars > 10) {
    return jsonErr("VALIDATION_ERROR", "Selecione de 1 a 10 corações.", 400);
  }
  const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, MAX_COMMENT) : "";
  if (!comment.length) {
    return jsonErr("VALIDATION_ERROR", "O comentário é obrigatório.", 400);
  }

  try {
    const row = await prisma.marketingCampaignResponse.create({
      data: {
        campaignId,
        userId: user.id,
        ratingStars,
        comment,
      },
      select: { id: true, createdAt: true },
    });
    revalidateTag("public-mothers-day-messages-v1", "max");
    return jsonOk({ id: row.id, createdAt: row.createdAt.toISOString() });
  } catch {
    // Unique(campaignId,userId): impede duplicação
    return jsonErr("ALREADY_SUBMITTED", "Você já enviou sua avaliação para esta campanha.", 409);
  }
}

