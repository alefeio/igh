import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteTestimonialSchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteTestimonialSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const existing = await prisma.siteTestimonial.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Depoimento nao encontrado.", 404);
  const item = await prisma.siteTestimonial.update({
    where: { id },
    data: {
      name: parsed.data.name,
      roleOrContext: parsed.data.roleOrContext ?? undefined,
      quote: parsed.data.quote,
      photoUrl: parsed.data.photoUrl === "" ? null : (parsed.data.photoUrl ?? undefined),
      order: parsed.data.order ?? undefined,
      isActive: parsed.data.isActive ?? undefined,
    },
  });
  return jsonOk({ item });
}

export async function DELETE(_r: Request, ctx: Ctx) {
  await requireRole("MASTER");
  const { id } = await ctx.params;
  const existing = await prisma.siteTestimonial.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Depoimento nao encontrado.", 404);
  await prisma.siteTestimonial.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
