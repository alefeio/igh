import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteUnitSchema } from "@/lib/validators/site";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const item = await prisma.siteUnit.findUnique({
    where: { id },
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  if (!item) return jsonErr("NOT_FOUND", "Unidade não encontrada.", 404);
  return jsonOk({ item });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = siteUnitSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);

  const existing = await prisma.siteUnit.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!existing) return jsonErr("NOT_FOUND", "Unidade não encontrada.", 404);

  if (parsed.data.slug !== existing.slug) {
    const dup = await prisma.siteUnit.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
    if (dup) return jsonErr("DUPLICATE_SLUG", "Já existe uma unidade com este slug.", 409);
  }

  const updated = await prisma.siteUnit.update({
    where: { id },
    data: {
      slug: parsed.data.slug,
      city: parsed.data.city,
      state: parsed.data.state.toUpperCase().slice(0, 2),
      addressLine: parsed.data.addressLine?.trim() ? parsed.data.addressLine.trim() : null,
      locationName: parsed.data.locationName?.trim() ? parsed.data.locationName.trim() : null,
      whatsapp: parsed.data.whatsapp?.trim() ? parsed.data.whatsapp.trim() : null,
      heroBadge: parsed.data.heroBadge?.trim() ? parsed.data.heroBadge.trim() : null,
      heroTitle: parsed.data.heroTitle?.trim() ? parsed.data.heroTitle.trim() : null,
      heroText: parsed.data.heroText?.trim() ? parsed.data.heroText.trim() : null,
      heroImageUrl: parsed.data.heroImageUrl?.trim() ? parsed.data.heroImageUrl.trim() : null,
      benefitsBadge: parsed.data.benefitsBadge?.trim() ? parsed.data.benefitsBadge.trim() : null,
      benefitsTitle: parsed.data.benefitsTitle?.trim() ? parsed.data.benefitsTitle.trim() : null,
      benefitsText: parsed.data.benefitsText?.trim() ? parsed.data.benefitsText.trim() : null,
      benefitsBullets: parsed.data.benefitsBullets ?? [],
      benefitsImageUrl: parsed.data.benefitsImageUrl?.trim() ? parsed.data.benefitsImageUrl.trim() : null,
      galleryImages: parsed.data.galleryImages ?? [],
      isActive: parsed.data.isActive ?? true,
    },
  });

  const courseIds = parsed.data.courseIds ?? [];
  await prisma.$transaction([
    prisma.siteUnitCourse.deleteMany({ where: { unitId: id } }),
    ...(courseIds.length
      ? [
          prisma.siteUnitCourse.createMany({
            data: courseIds.map((courseId, index) => ({ unitId: id, courseId, order: index })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  const out = await prisma.siteUnit.findUnique({
    where: { id: updated.id },
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  return jsonOk({ item: out ?? updated });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const existing = await prisma.siteUnit.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return jsonErr("NOT_FOUND", "Unidade não encontrada.", 404);
  await prisma.siteUnit.delete({ where: { id } });
  return jsonOk({ deleted: true });
}

