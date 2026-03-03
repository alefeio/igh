import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteNewsPostSchema } from "@/lib/validators/site";

export async function GET(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") || undefined;
  const items = await prisma.siteNewsPost.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: { category: true },
  });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = siteNewsPostSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const slugVal = parsed.data.slug || parsed.data.title.toLowerCase().replace(/\s+/g, "-");
  if (await prisma.siteNewsPost.findUnique({ where: { slug: slugVal } }))
    return jsonErr("DUPLICATE_SLUG", "Slug em uso.", 409);
  const item = await prisma.siteNewsPost.create({
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
  return jsonOk({ item }, { status: 201 });
}
