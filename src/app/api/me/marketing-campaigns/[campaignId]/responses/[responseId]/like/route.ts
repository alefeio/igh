import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

type RouteCtx = { params: Promise<{ campaignId: string; responseId: string }> };

async function ensureParticipant(campaignId: string, userId: string) {
  const row = await prisma.marketingCampaignResponse.findFirst({
    where: { campaignId, userId },
    select: { id: true },
  });
  return !!row;
}

export async function POST(_request: Request, ctx: RouteCtx) {
  const user = await requireRole("STUDENT");
  const { campaignId, responseId } = await ctx.params;

  if (!(await ensureParticipant(campaignId, user.id))) {
    return jsonErr("FORBIDDEN", "Envie sua declaração antes de curtir.", 403);
  }

  const response = await prisma.marketingCampaignResponse.findUnique({
    where: { id: responseId },
    select: { id: true, campaignId: true, userId: true },
  });
  if (!response || response.campaignId !== campaignId) {
    return jsonErr("NOT_FOUND", "Declaração não encontrada.", 404);
  }
  if (response.userId === user.id) {
    return jsonErr("FORBIDDEN", "Você não pode curtir a própria declaração.", 403);
  }

  try {
    await prisma.marketingCampaignResponseLike.create({
      data: { responseId, userId: user.id },
    });
  } catch {
    return jsonErr("ALREADY_LIKED", "Você já curtiu esta declaração.", 409);
  }

  const likeCount = await prisma.marketingCampaignResponseLike.count({
    where: { responseId },
  });

  return jsonOk({ liked: true, likeCount });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const user = await requireRole("STUDENT");
  const { campaignId, responseId } = await ctx.params;

  if (!(await ensureParticipant(campaignId, user.id))) {
    return jsonErr("FORBIDDEN", "Envie sua declaração antes de usar curtidas.", 403);
  }

  const response = await prisma.marketingCampaignResponse.findUnique({
    where: { id: responseId },
    select: { campaignId: true },
  });
  if (!response || response.campaignId !== campaignId) {
    return jsonErr("NOT_FOUND", "Declaração não encontrada.", 404);
  }

  await prisma.marketingCampaignResponseLike.deleteMany({
    where: { responseId, userId: user.id },
  });

  const likeCount = await prisma.marketingCampaignResponseLike.count({
    where: { responseId },
  });

  return jsonOk({ liked: false, likeCount });
}
