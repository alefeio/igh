import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonOk, jsonErr } from "@/lib/http";
import { siteTransparencyCategorySchema, reorderSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  const items = await prisma.siteTransparencyCategory.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = siteTransparencyCategorySchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const slugVal = parsed.data.slug || parsed.data.name.toLowerCase().replace(/\s+/g, "-");
  const exists = await prisma.siteTransparencyCategory.findUnique({ where: { slug: slugVal } });
  if (exists) return jsonErr("DUPLICATE_SLUG", "Slug em uso.", 409);
  const max = await prisma.siteTransparencyCategory.aggregate({ _max: { order: true } });
  const item = await prisma.siteTransparencyCategory.create({
    data: {
      name: parsed.data.name,
      slug: slugVal,
      order: parsed.data.order ?? (max._max.order ?? -1) + 1,
      isActive: parsed.data.isActive ?? true,
    },
  });
  return jsonOk({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  await prisma.$transaction(
    parsed.data.ids.map((id, i) => prisma.siteTransparencyCategory.update({ where: { id }, data: { order: i } }))
  );
  const items = await prisma.siteTransparencyCategory.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
