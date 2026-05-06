import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr } from "@/lib/http";

type RouteCtx = { params: Promise<{ id: string }> };

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  // CSV RFC4180: wrap in quotes if contains quote, comma, or newline
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;

  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true },
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

  const header = [
    "campaignId",
    "campaignSlug",
    "campaignTitle",
    "responseId",
    "ratingStars",
    "comment",
    "createdAt",
    "userId",
    "userName",
    "userEmail",
    "userRole",
  ];

  const lines = [
    header.map(csvEscape).join(","),
    ...responses.map((r) =>
      [
        campaign.id,
        campaign.slug,
        campaign.title,
        r.id,
        r.ratingStars,
        r.comment ?? "",
        r.createdAt.toISOString(),
        r.user.id,
        r.user.name,
        r.user.email,
        r.user.role,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];

  // BOM ajuda Excel a abrir UTF-8 com acentos
  const csv = `\uFEFF${lines.join("\r\n")}\r\n`;

  const safeSlug = (campaign.slug || "campanha").replace(/[^a-z0-9-_]+/gi, "-");
  const filename = `avaliacoes-${safeSlug}.csv`;

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

