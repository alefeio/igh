import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { reorderSchema, siteUnitSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const items = await prisma.siteUnit.findMany({
    orderBy: [{ city: "asc" }, { state: "asc" }],
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = siteUnitSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);

  const slug = parsed.data.slug;
  const exists = await prisma.siteUnit.findUnique({ where: { slug } });
  if (exists) return jsonErr("DUPLICATE_SLUG", "Já existe uma unidade com este slug.", 409);

  const payload = {
    slug,
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
    courseIds: parsed.data.courseIds ?? [],
  };

  if (await enqueueIfAdmin(user, "site_unit", "create", null, payload)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE }, { status: 201 });
  }

  const { courseIds, ...unitData } = payload;
  const item = await prisma.siteUnit.create({ data: unitData });

  if (courseIds.length > 0) {
    await prisma.siteUnitCourse.createMany({
      data: courseIds.map((courseId, index) => ({ unitId: item.id, courseId, order: index })),
      skipDuplicates: true,
    });
  }

  const withCourses = await prisma.siteUnit.findUnique({
    where: { id: item.id },
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  return jsonOk({ item: withCourses ?? item }, { status: 201 });
}

/**
 * Reordena unidades por IDs (usado quando quisermos ordenar no painel futuramente).
 * Por ora, preservamos compatibilidade com padrão do CMS.
 */
export async function PATCH(request: Request) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  // Não há campo "order" em unidades ainda; retorna listagem atual.
  const items = await prisma.siteUnit.findMany({
    orderBy: [{ city: "asc" }, { state: "asc" }],
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  return jsonOk({ items });
}

