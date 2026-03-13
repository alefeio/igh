import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { tabletBannerSchema, reorderSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  const items = await prisma.tabletBanner.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = tabletBannerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const maxOrder = await prisma.tabletBanner.aggregate({ _max: { order: true } });
  const payload = {
    title: parsed.data.title ?? null,
    subtitle: parsed.data.subtitle ?? null,
    imageUrl: parsed.data.imageUrl || null,
    order: parsed.data.order ?? (maxOrder._max.order ?? -1) + 1,
    isActive: parsed.data.isActive ?? true,
  };
  const item = await prisma.tabletBanner.create({ data: payload });
  return jsonOk({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  await prisma.$transaction(
    parsed.data.ids.map((id, index) =>
      prisma.tabletBanner.update({ where: { id }, data: { order: index } })
    )
  );
  const items = await prisma.tabletBanner.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}

