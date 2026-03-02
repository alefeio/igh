import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
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
  await requireRole(["ADMIN", "MASTER"]);
  const items = await prisma.siteFormation.findMany({
    orderBy: [{ order: "asc" }],
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = siteFormationSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados invalidos", 400);
  const slug = parsed.data.slug || slugify(parsed.data.title);
  const exists = await prisma.siteFormation.findUnique({ where: { slug } });
  if (exists) return jsonErr("DUPLICATE_SLUG", "Ja existe uma formacao com este slug.", 409);
  const maxOrder = await prisma.siteFormation.aggregate({ _max: { order: true } });
  const item = await prisma.siteFormation.create({
    data: {
      title: parsed.data.title,
      slug,
      summary: parsed.data.summary ?? null,
      audience: parsed.data.audience ?? null,
      outcomes: parsed.data.outcomes ?? [],
      finalProject: parsed.data.finalProject ?? null,
      prerequisites: parsed.data.prerequisites ?? null,
      order: parsed.data.order ?? (maxOrder._max.order ?? -1) + 1,
      isActive: parsed.data.isActive ?? true,
    },
  });
  const courseIds = parsed.data.courseIds ?? [];
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
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados invalidos", 400);
  await prisma.$transaction(
    parsed.data.ids.map((id, i) => prisma.siteFormation.update({ where: { id }, data: { order: i } }))
  );
  const items = await prisma.siteFormation.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
