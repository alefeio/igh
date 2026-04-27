import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

type RouteCtx = { params: Promise<{ campaignId: string }> };

function peerDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Aluno";
  if (parts.length === 1) return parts[0]!;
  const last = parts[parts.length - 1]!;
  const initial = last.charAt(0).toUpperCase();
  return `${parts[0]} ${initial}.`;
}

export async function GET(_request: Request, ctx: RouteCtx) {
  const user = await requireRole("STUDENT");
  const { campaignId } = await ctx.params;

  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) return jsonErr("NOT_FOUND", "Campanha não encontrada.", 404);

  const participated = await prisma.marketingCampaignResponse.findFirst({
    where: { campaignId, userId: user.id },
    select: { id: true },
  });
  if (!participated) {
    return jsonErr("FORBIDDEN", "Envie sua declaração para ver as dos colegas.", 403);
  }

  const rows = await prisma.marketingCampaignResponse.findMany({
    where: { campaignId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      userId: true,
      ratingStars: true,
      comment: true,
      createdAt: true,
      user: { select: { name: true } },
      _count: { select: { likes: true } },
      likes: {
        where: { userId: user.id },
        select: { id: true },
        take: 1,
      },
    },
  });

  const items = rows.map((r) => ({
    id: r.id,
    isMine: r.userId === user.id,
    authorLabel: peerDisplayName(r.user.name),
    ratingStars: r.ratingStars,
    comment: r.comment ?? "",
    createdAt: r.createdAt.toISOString(),
    likeCount: r._count.likes,
    likedByMe: r.likes.length > 0,
  }));

  return jsonOk({ items });
}
