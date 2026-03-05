import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteFormationSchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET(_r: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const item = await prisma.siteFormation.findUnique({
    where: { id },
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  if (!item) return jsonErr("NOT_FOUND", "Formação não encontrada.", 404);
  return jsonOk({ item });
}

export async function PATCH(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteFormationSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  const existing = await prisma.siteFormation.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Formação não encontrada.", 404);
  const slug = parsed.data.slug || slugify(parsed.data.title);
  if (slug !== existing.slug) {
    const dup = await prisma.siteFormation.findUnique({ where: { slug } });
    if (dup) return jsonErr("DUPLICATE_SLUG", "Já existe uma formação com este slug.", 409);
  }

  if (parsed.data.courseIds !== undefined) {
    await prisma.siteFormationCourse.deleteMany({ where: { formationId: id } });
    const courseIds = parsed.data.courseIds;
    if (courseIds.length > 0) {
      const existingCourses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true },
      });
      const existingIds = new Set(existingCourses.map((c) => c.id));
      const validIds = courseIds.filter((cid) => existingIds.has(cid));
      await prisma.siteFormationCourse.createMany({
        data: validIds.map((courseId, index) => ({ formationId: id, courseId, order: index })),
        skipDuplicates: true,
      });
    }
  }

  const item = await prisma.siteFormation.update({
    where: { id },
    data: {
      title: parsed.data.title,
      slug,
      summary: parsed.data.summary ?? undefined,
      audience: parsed.data.audience ?? undefined,
      outcomes: parsed.data.outcomes ?? undefined,
      finalProject: parsed.data.finalProject ?? undefined,
      prerequisites: parsed.data.prerequisites ?? undefined,
      order: parsed.data.order ?? undefined,
      isActive: parsed.data.isActive ?? undefined,
    },
  });
  const withCourses = await prisma.siteFormation.findUnique({
    where: { id },
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  return jsonOk({ item: withCourses ?? item });
}

export async function DELETE(_r: Request, ctx: Ctx) {
  await requireRole("MASTER");
  const { id } = await ctx.params;
  const existing = await prisma.siteFormation.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Formação não encontrada.", 404);
  await prisma.siteFormation.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
