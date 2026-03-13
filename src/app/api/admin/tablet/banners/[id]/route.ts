import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { tabletBannerSchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = tabletBannerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const existing = await prisma.tabletBanner.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Banner não encontrado.", 404);
  }
  const payload = {
    title: parsed.data.title ?? undefined,
    subtitle: parsed.data.subtitle ?? undefined,
    imageUrl: parsed.data.imageUrl === "" ? null : (parsed.data.imageUrl ?? undefined),
    order: parsed.data.order ?? undefined,
    isActive: parsed.data.isActive ?? undefined,
  };
  const item = await prisma.tabletBanner.update({ where: { id }, data: payload });
  return jsonOk({ item });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  await requireRole("MASTER");
  const { id } = await ctx.params;
  const existing = await prisma.tabletBanner.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Banner não encontrado.", 404);
  }
  await prisma.tabletBanner.delete({ where: { id } });
  return jsonOk({ deleted: true });
}

