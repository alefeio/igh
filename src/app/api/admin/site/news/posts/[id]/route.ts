import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteNewsPostSchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_r: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const item = await prisma.siteNewsPost.findUnique({
    where: { id: (await ctx.params).id },
    include: { category: true },
  });
  if (!item) return jsonErr("NOT_FOUND", "Post nao encontrado.", 404);
  return jsonOk({ item });
}

export async function PATCH(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteNewsPostSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const existing = await prisma.siteNewsPost.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Post nao encontrado.", 404);
  const slugVal = parsed.data.slug || parsed.data.title.toLowerCase().replace(/\s+/g, "-");
  if (slugVal !== existing.slug) {
    const dup = await prisma.siteNewsPost.findUnique({ where: { slug: slugVal } });
    if (dup) return jsonErr("DUPLICATE_SLUG", "Slug em uso.", 409);
  }
  const item = await prisma.siteNewsPost.update({
    where: { id },
    data: {
      title: parsed.data.title,
      slug: slugVal,
      excerpt: parsed.data.excerpt ?? undefined,
      content: parsed.data.content ?? undefined,
      coverImageUrl: parsed.data.coverImageUrl === "" ? null : parsed.data.coverImageUrl ?? undefined,
      imageUrls: parsed.data.imageUrls ?? undefined,
      categoryId: parsed.data.categoryId ?? undefined,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : undefined,
      isPublished: parsed.data.isPublished ?? undefined,
    },
    include: { category: true },
  });
  return jsonOk({ item });
}

export async function DELETE(_r: Request, ctx: Ctx) {
  await requireRole("MASTER");
  const { id } = await ctx.params;
  const existing = await prisma.siteNewsPost.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Post nao encontrado.", 404);
  await prisma.siteNewsPost.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
