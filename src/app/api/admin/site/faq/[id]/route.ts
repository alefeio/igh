import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteFaqItemSchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteFaqItemSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const existing = await prisma.siteFaqItem.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Item nao encontrado.", 404);
  const item = await prisma.siteFaqItem.update({
    where: { id },
    data: {
      question: parsed.data.question,
      answer: parsed.data.answer,
      order: parsed.data.order ?? undefined,
      isActive: parsed.data.isActive ?? undefined,
    },
  });
  return jsonOk({ item });
}

export async function DELETE(_r: Request, ctx: Ctx) {
  await requireRole("MASTER");
  const { id } = await ctx.params;
  const existing = await prisma.siteFaqItem.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Item nao encontrado.", 404);
  await prisma.siteFaqItem.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
