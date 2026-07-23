import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteFormationSchema, reorderSchema } from "@/lib/validators/site";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const items = await prisma.siteFormation.findMany({
    orderBy: [{ order: "asc" }],
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = siteFormationSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados invalidos", 400);
  const slug = parsed.data.slug || slugify(parsed.data.title);
  const exists = await prisma.siteFormation.findUnique({ where: { slug } });
  if (exists) return jsonErr("DUPLICATE_SLUG", "Ja existe uma formacao com este slug.", 409);
  const maxOrder = await prisma.siteFormation.aggregate({ _max: { order: true } });
  const courseIds = parsed.data.courseIds ?? [];
  const payload = {
    title: parsed.data.title,
    slug,
    summary: parsed.data.summary ?? null,
    audience: parsed.data.audience ?? null,
    outcomes: parsed.data.outcomes ?? [],
    finalProject: parsed.data.finalProject ?? null,
    prerequisites: parsed.data.prerequisites ?? null,
    order: parsed.data.order ?? (maxOrder._max.order ?? -1) + 1,
    isActive: parsed.data.isActive ?? true,
    courseIds,
  };
  if (await enqueueIfAdmin(user, "site_formation", "create", null, payload)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE }, { status: 201 });
  }
  const item = await prisma.siteFormation.create({
    data: {
      title: payload.title,
      slug: payload.slug,
      summary: payload.summary,
      audience: payload.audience,
      outcomes: payload.outcomes,
      finalProject: payload.finalProject,
      prerequisites: payload.prerequisites,
      order: payload.order,
      isActive: payload.isActive,
    },
  });
  if (courseIds.length > 0) {
    await prisma.siteFormationCourse.createMany({
      data: courseIds.map((courseId, index) => ({
        formationId: item.id,
        courseId,
        order: index,
      })),
      skipDuplicates: true,
    });
  }
  const withCourses = await prisma.siteFormation.findUnique({
    where: { id: item.id },
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  return jsonOk({ item: withCourses ?? item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados invalidos", 400);
  const current = await prisma.siteFormation.findMany({
    orderBy: [{ order: "asc" }],
    select: { id: true },
  });
  const previous = { ids: current.map((i) => i.id) };
  if (await enqueueIfAdmin(user, "site_formation", "update", null, { ids: parsed.data.ids }, previous)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  await prisma.$transaction(
    parsed.data.ids.map((id, i) => prisma.siteFormation.update({ where: { id }, data: { order: i } }))
  );
  const items = await prisma.siteFormation.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
