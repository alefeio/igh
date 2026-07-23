import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteBannerSchema, reorderSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const items = await prisma.siteBanner.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = siteBannerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const maxOrder = await prisma.siteBanner.aggregate({ _max: { order: true } });
  const payload = {
    title: parsed.data.title ?? null,
    subtitle: parsed.data.subtitle ?? null,
    ctaLabel: parsed.data.ctaLabel ?? null,
    ctaHref: parsed.data.ctaHref ?? null,
    imageUrl: parsed.data.imageUrl || null,
    order: parsed.data.order ?? (maxOrder._max.order ?? -1) + 1,
    isActive: parsed.data.isActive ?? true,
  };
  if (await enqueueIfAdmin(user, "site_banner", "create", null, payload)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE }, { status: 201 });
  }
  const item = await prisma.siteBanner.create({ data: payload });
  return jsonOk({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const current = await prisma.siteBanner.findMany({
    orderBy: [{ order: "asc" }],
    select: { id: true },
  });
  const previous = { ids: current.map((b) => b.id) };
  if (await enqueueIfAdmin(user, "site_banner", "update", null, { ids: parsed.data.ids }, previous)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  await prisma.$transaction(
    parsed.data.ids.map((id, index) =>
      prisma.siteBanner.update({ where: { id }, data: { order: index } })
    )
  );
  const items = await prisma.siteBanner.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
