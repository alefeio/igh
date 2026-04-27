import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;

  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
    },
  });
  if (!campaign) return jsonErr("NOT_FOUND", "Campanha não encontrada.", 404);

  const responses = await prisma.marketingCampaignResponse.findMany({
    where: { campaignId: id },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      ratingStars: true,
      comment: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return jsonOk({
    campaign: {
      ...campaign,
      startsAt: campaign.startsAt ? campaign.startsAt.toISOString() : null,
      endsAt: campaign.endsAt ? campaign.endsAt.toISOString() : null,
      createdAt: campaign.createdAt.toISOString(),
    },
    responses: responses.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  await requireRole(["MASTER", "ADMIN"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);

  const existing = await prisma.marketingCampaign.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return jsonErr("NOT_FOUND", "Campanha não encontrada.", 404);

  const data: Record<string, unknown> = {};
  if (typeof body?.title === "string") data.title = body.title.trim() || undefined;
  if (typeof body?.description === "string") data.description = body.description.trim() || null;
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body?.startsAt === "string") data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (typeof body?.endsAt === "string") data.endsAt = body.endsAt ? new Date(body.endsAt) : null;

  const campaign = await prisma.marketingCampaign.update({
    where: { id },
    data: data as never,
    select: { id: true },
  });
  return jsonOk({ id: campaign.id });
}

