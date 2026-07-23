import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteNewsCategorySchema } from "@/lib/validators/site";

type Context = { params: Promise<{ id: string }> };

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

export async function GET(_request: Request, context: Context) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await context.params;

  const item = await prisma.siteNewsCategory.findUnique({ where: { id } });
  if (!item) return jsonErr("NOT_FOUND", "Categoria não encontrada.", 404);
  return jsonOk({ item });
}

export async function PATCH(request: Request, context: Context) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = siteNewsCategorySchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.siteNewsCategory.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Categoria não encontrada.", 404);

  const slugVal = parsed.data.slug || parsed.data.name.toLowerCase().replace(/\s+/g, "-");
  if (slugVal !== existing.slug) {
    const dup = await prisma.siteNewsCategory.findFirst({
      where: { slug: slugVal, NOT: { id } },
      select: { id: true },
    });
    if (dup) return jsonErr("DUPLICATE_SLUG", "Slug em uso.", 409);
  }

  const payload = {
    name: parsed.data.name,
    slug: slugVal,
    order: parsed.data.order ?? existing.order,
    isActive: parsed.data.isActive ?? existing.isActive,
  };

  if (
    await enqueueIfAdmin(user, "site_news_category", "update", id, payload, categoryPrevious(existing))
  ) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }

  const item = await prisma.siteNewsCategory.update({
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

export async function DELETE(_request: Request, context: Context) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await context.params;

  const existing = await prisma.siteNewsCategory.findUnique({
    where: { id },
    include: { _count: { select: { posts: true } } },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Categoria não encontrada.", 404);
  if (existing._count.posts > 0) {
    return jsonErr("CONFLICT", "Existem notícias nesta categoria. Remova-as ou altere a categoria antes.", 409);
  }

  if (
    await enqueueIfAdmin(user, "site_news_category", "delete", id, {}, categoryPrevious(existing))
  ) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }

  await prisma.siteNewsCategory.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
