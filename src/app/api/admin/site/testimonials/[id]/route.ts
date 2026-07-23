import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteTestimonialSchema } from "@/lib/validators/site";

type RouteCtx = { params: Promise<{ id: string }> };

function testimonialPrevious(existing: {
  name: string;
  roleOrContext: string | null;
  quote: string;
  photoUrl: string | null;
  order: number;
  isActive: boolean;
}) {
  return {
    name: existing.name,
    roleOrContext: existing.roleOrContext,
    quote: existing.quote,
    photoUrl: existing.photoUrl,
    order: existing.order,
    isActive: existing.isActive,
  };
}

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
  if (
    await enqueueIfAdmin(user, "site_testimonial", "update", id, payload, testimonialPrevious(existing))
  ) {
    return jsonOk({
      pending: true,
      message: PENDING_SITE_CHANGE_MESSAGE,
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
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const existing = await prisma.siteTestimonial.findUnique({ where: { id } });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Depoimento não encontrado.", 404);
  }
  if (await enqueueIfAdmin(user, "site_testimonial", "delete", id, {}, testimonialPrevious(existing))) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  await prisma.siteTestimonial.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
