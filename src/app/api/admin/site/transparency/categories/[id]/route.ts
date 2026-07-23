import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteTransparencyCategorySchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function categoryPrevious(existing: {
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
}) {
  return {
    name: existing.name,
    slug: existing.slug,
    order: existing.order,
    isActive: existing.isActive,
  };
}

export async function PATCH(request: Request, ctx: Ctx) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteTransparencyCategorySchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const existing = await prisma.siteTransparencyCategory.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Categoria nao encontrada.", 404);
  const slugVal = parsed.data.slug || slug(parsed.data.name);
  if (slugVal !== existing.slug) {
    const dup = await prisma.siteTransparencyCategory.findUnique({ where: { slug: slugVal } });
    if (dup) return jsonErr("DUPLICATE_SLUG", "Slug em uso.", 409);
  }
  const payload = {
    name: parsed.data.name,
    slug: slugVal,
    order: parsed.data.order ?? existing.order,
    isActive: parsed.data.isActive ?? existing.isActive,
  };
  if (
    await enqueueIfAdmin(
      user,
      "site_transparency_category",
      "update",
      id,
      payload,
      categoryPrevious(existing)
    )
  ) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  const item = await prisma.siteTransparencyCategory.update({
    where: { id },
    data: {
      name: payload.name,
      slug: payload.slug,
      order: payload.order,
      isActive: payload.isActive,
    },
  });
  return jsonOk({ item });
}

export async function DELETE(_r: Request, ctx: Ctx) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const existing = await prisma.siteTransparencyCategory.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Categoria nao encontrada.", 404);
  if (
    await enqueueIfAdmin(
      user,
      "site_transparency_category",
      "delete",
      id,
      {},
      categoryPrevious(existing)
    )
  ) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  await prisma.siteTransparencyCategory.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
