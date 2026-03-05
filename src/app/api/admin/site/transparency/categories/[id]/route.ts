import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteTransparencyCategorySchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function PATCH(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
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
  const item = await prisma.siteTransparencyCategory.update({
    where: { id },
    data: {
      name: parsed.data.name,
      slug: slugVal,
      order: parsed.data.order ?? undefined,
      isActive: parsed.data.isActive ?? undefined,
    },
  });
  return jsonOk({ item });
}

export async function DELETE(_r: Request, ctx: Ctx) {
  await requireRole("MASTER");
  const { id } = await ctx.params;
  const existing = await prisma.siteTransparencyCategory.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Categoria nao encontrada.", 404);
  await prisma.siteTransparencyCategory.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
