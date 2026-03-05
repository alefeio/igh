import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPendingSiteChange } from "@/lib/pending-site-change";
import { siteBannerSchema, reorderSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  const items = await prisma.siteBanner.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);
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
  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_banner", "create", null, payload);
    return jsonOk({ pending: true, message: "Alteração enviada para aprovação do Master." }, { status: 201 });
  }
  const item = await prisma.siteBanner.create({ data: payload });
  return jsonOk({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_banner", "update", null, { ids: parsed.data.ids });
    return jsonOk({ pending: true, message: "Alteração enviada para aprovação do Master." });
  }
  await prisma.$transaction(
    parsed.data.ids.map((id, index) =>
      prisma.siteBanner.update({ where: { id }, data: { order: index } })
    )
  );
  const items = await prisma.siteBanner.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
