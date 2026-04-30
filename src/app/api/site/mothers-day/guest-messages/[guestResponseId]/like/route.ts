import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { jsonErr } from "@/lib/http";

type RouteCtx = { params: Promise<{ guestResponseId: string }> };

const ANON_COOKIE = "mothers_day_like_anon";
const MAX_AGE_DAYS = 365;
const MOTHERS_CAMPAIGN_SLUG = "dia-das-maes-2026";

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * MAX_AGE_DAYS,
  };
}

function resolveOrCreateAnonId(request: Request): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ANON_COOKIE}=([^;]+)`));
  const anonId = m?.[1]?.trim();
  return anonId || randomUUID();
}

export async function POST(request: Request, ctx: RouteCtx) {
  const { guestResponseId } = await ctx.params;
  const anonId = resolveOrCreateAnonId(request);

  const row = await prisma.marketingCampaignGuestResponse.findUnique({
    where: { id: guestResponseId },
    select: { id: true, campaign: { select: { slug: true } } },
  });
  if (!row) return jsonErr("NOT_FOUND", "Mensagem não encontrada.", 404);
  if (row.campaign.slug !== MOTHERS_CAMPAIGN_SLUG) {
    return jsonErr("FORBIDDEN", "Mensagem não disponível para curtidas públicas.", 403);
  }

  try {
    await prisma.marketingCampaignGuestResponsePublicLike.create({
      data: { guestResponseId, anonId },
      select: { id: true },
    });
  } catch {
    return jsonErr("ALREADY_LIKED", "Você já curtiu esta mensagem.", 409);
  }

  const likeCount = await prisma.marketingCampaignGuestResponsePublicLike.count({ where: { guestResponseId } });
  revalidateTag("public-mothers-day-messages-v2", "max");

  const res = NextResponse.json({ ok: true as const, data: { liked: true, likeCount } });
  res.cookies.set(ANON_COOKIE, anonId, getCookieOptions());
  return res;
}

