import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPendingSiteChange } from "@/lib/pending-site-change";
import { siteBannerSchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteBannerSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  const existing = await prisma.siteBanner.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Banner não encontrado.", 404);
  const payload = {
    title: parsed.data.title ?? undefined,
    subtitle: parsed.data.subtitle ?? undefined,
    ctaLabel: parsed.data.ctaLabel ?? undefined,
    ctaHref: parsed.data.ctaHref ?? undefined,
    imageUrl: parsed.data.imageUrl === "" ? null : (parsed.data.imageUrl ?? undefined),
    order: parsed.data.order ?? undefined,
    isActive: parsed.data.isActive ?? undefined,
  };
  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_banner", "update", id, payload);
    return jsonOk({ pending: true, message: "Alteração enviada para aprovação do Master." });
  }
  const item = await prisma.siteBanner.update({ where: { id }, data: payload });
  return jsonOk({ item });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  await requireRole("MASTER");
  const { id } = await ctx.params;
  const existing = await prisma.siteBanner.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Banner não encontrado.", 404);
  await prisma.siteBanner.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
