import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPendingSiteChange } from "@/lib/pending-site-change";
import { siteTestimonialSchema } from "@/lib/validators/site";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteCtx) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteTestimonialSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const existing = await prisma.siteTestimonial.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Depoimento não encontrado.", 404);
  }
  const payload = {
    name: parsed.data.name,
    roleOrContext: parsed.data.roleOrContext?.trim() ? parsed.data.roleOrContext.trim() : null,
    quote: parsed.data.quote,
    photoUrl: parsed.data.photoUrl?.trim() ? parsed.data.photoUrl.trim() : null,
    order: parsed.data.order ?? existing.order,
    isActive: parsed.data.isActive ?? existing.isActive,
  };
  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_testimonial", "update", id, payload);
    return jsonOk({
      pending: true,
      message: "Alteração enviada para aprovação do Master.",
      item: existing,
    });
  }
  const item = await prisma.siteTestimonial.update({
    where: { id },
    data: {
      name: payload.name,
      roleOrContext: payload.roleOrContext,
      quote: payload.quote,
      photoUrl: payload.photoUrl,
      order: payload.order,
      isActive: payload.isActive,
    },
  });
  return jsonOk({ item });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const existing = await prisma.siteTestimonial.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Depoimento não encontrado.", 404);
  }
  await prisma.siteTestimonial.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
