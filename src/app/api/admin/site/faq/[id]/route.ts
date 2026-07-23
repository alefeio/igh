import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteFaqItemSchema } from "@/lib/validators/site";

type RouteCtx = { params: Promise<{ id: string }> };

function faqPrevious(existing: {
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
}) {
  return {
    question: existing.question,
    answer: existing.answer,
    order: existing.order,
    isActive: existing.isActive,
  };
}

export async function GET(_request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const item = await prisma.siteFaqItem.findUnique({ where: { id } });
  if (!item) return jsonErr("NOT_FOUND", "Item FAQ não encontrado.", 404);
  return jsonOk({ item });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteFaqItemSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const existing = await prisma.siteFaqItem.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Item FAQ não encontrado.", 404);

  const payload = {
    question: parsed.data.question,
    answer: parsed.data.answer,
    order: parsed.data.order ?? existing.order,
    isActive: parsed.data.isActive ?? existing.isActive,
  };
  if (await enqueueIfAdmin(user, "site_faq_item", "update", id, payload, faqPrevious(existing))) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  const item = await prisma.siteFaqItem.update({ where: { id }, data: payload });
  return jsonOk({ item });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const existing = await prisma.siteFaqItem.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Item FAQ não encontrado.", 404);

  if (await enqueueIfAdmin(user, "site_faq_item", "delete", id, {}, faqPrevious(existing))) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  await prisma.siteFaqItem.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
