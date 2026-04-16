import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteNewsPostSchema } from "@/lib/validators/site";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const item = await prisma.siteNewsPost.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!item) {
    return jsonErr("NOT_FOUND", "Post não encontrado.", 404);
  }
  return jsonOk({ item });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteNewsPostSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.siteNewsPost.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Post não encontrado.", 404);
  }

  const slugVal = parsed.data.slug || parsed.data.title.toLowerCase().replace(/\s+/g, "-");
  if (slugVal !== existing.slug) {
    const dup = await prisma.siteNewsPost.findFirst({
      where: { slug: slugVal, NOT: { id } },
      select: { id: true },
    });
    if (dup) {
      return jsonErr("DUPLICATE_SLUG", "Slug em uso.", 409);
    }
  }

  const item = await prisma.siteNewsPost.update({
    where: { id },
    data: {
      title: parsed.data.title,
      slug: slugVal,
      excerpt: parsed.data.excerpt ?? null,
      content: parsed.data.content ?? null,
      coverImageUrl: parsed.data.coverImageUrl || null,
      imageUrls: parsed.data.imageUrls ?? [],
      categoryId: parsed.data.categoryId ?? null,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
      isPublished: parsed.data.isPublished ?? false,
    },
    include: { category: true },
  });
  return jsonOk({ item });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const existing = await prisma.siteNewsPost.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Post não encontrado.", 404);
  }
  await prisma.siteNewsPost.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
