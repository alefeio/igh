import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteMenuItemSchema, reorderSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);

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
  await requireRole(["ADMIN", "MASTER"]);

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
  const item = await prisma.siteMenuItem.create({
    data: {
      label,
      href,
      order: order ?? (maxOrder._max.order ?? -1) + 1,
      parentId: parentId ?? undefined,
      isExternal: isExternal ?? false,
      isVisible: isVisible ?? true,
    },
  });
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
      prisma.siteMenuItem.update({ where: { id }, data: { order: index } })
    )
  );
  const items = await prisma.siteMenuItem.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
