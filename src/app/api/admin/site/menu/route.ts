import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteMenuItemSchema, reorderSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);

  const items = await prisma.siteMenuItem.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      children: { orderBy: [{ order: "asc" }] },
    },
  });
  const roots = items.filter((i) => !i.parentId);
  const withChildren = roots.map((r) => ({
    ...r,
    children: items.filter((c) => c.parentId === r.id),
  }));
  return jsonOk({ items: withChildren, flat: items });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);

  const body = await request.json().catch(() => null);
  const parsed = siteMenuItemSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { label, href, order, parentId, isExternal, isVisible } = parsed.data;
  const maxOrder = await prisma.siteMenuItem.aggregate({
    _max: { order: true },
    where: { parentId: parentId ?? null },
  });
  const payload = {
    label,
    href,
    order: order ?? (maxOrder._max.order ?? -1) + 1,
    parentId: parentId ?? null,
    isExternal: isExternal ?? false,
    isVisible: isVisible ?? true,
  };
  if (await enqueueIfAdmin(user, "site_menu_item", "create", null, payload)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE }, { status: 201 });
  }
  const item = await prisma.siteMenuItem.create({
    data: { ...payload, parentId: payload.parentId ?? undefined },
  });
  return jsonOk({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);

  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const current = await prisma.siteMenuItem.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const previous = { ids: current.map((m) => m.id) };
  if (await enqueueIfAdmin(user, "site_menu", "update", null, { ids: parsed.data.ids }, previous)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  await prisma.$transaction(
    parsed.data.ids.map((id, index) =>
      prisma.siteMenuItem.update({ where: { id }, data: { order: index } })
    )
  );
  const items = await prisma.siteMenuItem.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
