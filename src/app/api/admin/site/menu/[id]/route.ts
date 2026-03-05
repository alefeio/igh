import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPendingSiteChange } from "@/lib/pending-site-change";
import { siteMenuItemSchema } from "@/lib/validators/site";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await context.params;

  const item = await prisma.siteMenuItem.findUnique({
    where: { id },
    include: { children: { orderBy: [{ order: "asc" }] } },
  });
  if (!item) return jsonErr("NOT_FOUND", "Item não encontrado.", 404);
  return jsonOk({ item });
}

export async function PATCH(request: Request, context: Context) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = siteMenuItemSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.siteMenuItem.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Item não encontrado.", 404);

  const payload = {
    label: parsed.data.label,
    href: parsed.data.href,
    order: parsed.data.order ?? undefined,
    parentId: parsed.data.parentId ?? undefined,
    isExternal: parsed.data.isExternal ?? undefined,
    isVisible: parsed.data.isVisible ?? undefined,
  };
  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_menu_item", "update", id, payload);
    return jsonOk({ pending: true, message: "Alteração enviada para aprovação do Master." });
  }
  const item = await prisma.siteMenuItem.update({ where: { id }, data: payload });
  return jsonOk({ item });
}

export async function DELETE(_request: Request, context: Context) {
  await requireRole("MASTER");
  const { id } = await context.params;

  const existing = await prisma.siteMenuItem.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Item não encontrado.", 404);
  if (existing._count.children > 0) {
    return jsonErr("CONFLICT", "Remova primeiro os subitens.", 409);
  }

  await prisma.siteMenuItem.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
