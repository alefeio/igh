import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteNewsCategorySchema, reorderSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const items = await prisma.siteNewsCategory.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = siteNewsCategorySchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const slugVal = parsed.data.slug || parsed.data.name.toLowerCase().replace(/\s+/g, "-");
  if (await prisma.siteNewsCategory.findUnique({ where: { slug: slugVal } }))
    return jsonErr("DUPLICATE_SLUG", "Slug em uso.", 409);
  const max = await prisma.siteNewsCategory.aggregate({ _max: { order: true } });
  const payload = {
    name: parsed.data.name,
    slug: slugVal,
    order: parsed.data.order ?? (max._max.order ?? -1) + 1,
    isActive: parsed.data.isActive ?? true,
  };
  if (await enqueueIfAdmin(user, "site_news_category", "create", null, payload)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE }, { status: 201 });
  }
  const item = await prisma.siteNewsCategory.create({ data: payload });
  return jsonOk({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const current = await prisma.siteNewsCategory.findMany({
    orderBy: [{ order: "asc" }],
    select: { id: true },
  });
  const previous = { ids: current.map((i) => i.id) };
  if (await enqueueIfAdmin(user, "site_news_category", "update", null, { ids: parsed.data.ids }, previous)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  await prisma.$transaction(
    parsed.data.ids.map((id, i) => prisma.siteNewsCategory.update({ where: { id }, data: { order: i } }))
  );
  const items = await prisma.siteNewsCategory.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
