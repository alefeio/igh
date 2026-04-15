import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPendingSiteChange } from "@/lib/pending-site-change";
import { siteBannerSchema } from "@/lib/validators/site";

type RouteCtx = { params: Promise<{ id: string }> };

function mergeBannerPayload(
  parsed: z.infer<typeof siteBannerSchema>,
  existing: {
    title: string | null;
    subtitle: string | null;
    ctaLabel: string | null;
    ctaHref: string | null;
    imageUrl: string | null;
    order: number;
    isActive: boolean;
  }
) {
  const optStr = (v: string | undefined, fallback: string | null) => {
    if (v === undefined) return fallback;
    const t = v.trim();
    return t.length ? t : null;
  };
  return {
    title: optStr(parsed.title, existing.title),
    subtitle: optStr(parsed.subtitle, existing.subtitle),
    ctaLabel: optStr(parsed.ctaLabel, existing.ctaLabel),
    ctaHref: optStr(parsed.ctaHref, existing.ctaHref),
    imageUrl:
      parsed.imageUrl !== undefined ? (parsed.imageUrl?.trim() || null) : existing.imageUrl,
    order: parsed.order ?? existing.order,
    isActive: parsed.isActive ?? existing.isActive,
  };
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteBannerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const existing = await prisma.siteBanner.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Banner não encontrado.", 404);
  }
  const payload = mergeBannerPayload(parsed.data, existing);

  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_banner", "update", id, payload);
    return jsonOk({
      pending: true,
      message: "Alteração enviada para aprovação do Master.",
      item: existing,
    });
  }

  const item = await prisma.siteBanner.update({
    where: { id },
    data: {
      title: payload.title,
      subtitle: payload.subtitle,
      ctaLabel: payload.ctaLabel,
      ctaHref: payload.ctaHref,
      imageUrl: payload.imageUrl,
      order: payload.order,
      isActive: payload.isActive,
    },
  });
  return jsonOk({ item });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const existing = await prisma.siteBanner.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Banner não encontrado.", 404);
  }
  await prisma.siteBanner.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
