import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { jsonErr } from "@/lib/http";

type RouteCtx = { params: Promise<{ responseId: string }> };

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

async function resolveOrCreateAnonId(request: Request): Promise<{ anonId: string; setCookie?: string }> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ANON_COOKIE}=([^;]+)`));
  const anonId = m?.[1]?.trim();
  if (anonId) return { anonId };

  const fresh = randomUUID();
  // NextResponse.cookies.set é mais seguro, mas aqui devolvemos o valor e setamos no response.
  return { anonId: fresh };
}

export async function POST(request: Request, ctx: RouteCtx) {
  const { responseId } = await ctx.params;
  const { anonId } = await resolveOrCreateAnonId(request);

  const response = await prisma.marketingCampaignResponse.findUnique({
    where: { id: responseId },
    select: { id: true, campaign: { select: { slug: true } } },
  });
  if (!response) return jsonErr("NOT_FOUND", "Mensagem não encontrada.", 404);
  if (response.campaign.slug !== MOTHERS_CAMPAIGN_SLUG) {
    return jsonErr("FORBIDDEN", "Mensagem não disponível para curtidas públicas.", 403);
  }

  try {
    await prisma.marketingCampaignResponsePublicLike.create({
      data: { responseId, anonId },
      select: { id: true },
    });
  } catch {
    return jsonErr("ALREADY_LIKED", "Você já curtiu esta mensagem.", 409);
  }

  const likeCount = await prisma.marketingCampaignResponsePublicLike.count({ where: { responseId } });
  revalidateTag("public-mothers-day-messages-v1", "max");

  const res = NextResponse.json({ ok: true as const, data: { liked: true, likeCount } });
  // garante persistência do bloqueio no servidor (cookie)
  res.cookies.set(ANON_COOKIE, anonId, getCookieOptions());
  return res;
}

