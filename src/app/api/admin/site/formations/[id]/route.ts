import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteFormationSchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formationPrevious(existing: {
  title: string;
  slug: string;
  summary: string | null;
  audience: string | null;
  outcomes: string[];
  finalProject: string | null;
  prerequisites: string | null;
  order: number;
  isActive: boolean;
  courses?: { courseId: string }[];
}) {
  return {
    title: existing.title,
    slug: existing.slug,
    summary: existing.summary,
    audience: existing.audience,
    outcomes: existing.outcomes,
    finalProject: existing.finalProject,
    prerequisites: existing.prerequisites,
    order: existing.order,
    isActive: existing.isActive,
    courseIds: existing.courses?.map((c) => c.courseId) ?? [],
  };
}

export async function GET(_r: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const item = await prisma.siteFormation.findUnique({
    where: { id },
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  if (!item) return jsonErr("NOT_FOUND", "Formação não encontrada.", 404);
  return jsonOk({ item });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteFormationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.siteFormation.findUnique({
    where: { id },
    include: { courses: { orderBy: [{ order: "asc" }] } },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Formação não encontrada.", 404);

  const slug = parsed.data.slug || slugify(parsed.data.title);
  if (slug !== existing.slug) {
    const dup = await prisma.siteFormation.findUnique({ where: { slug } });
    if (dup) return jsonErr("DUPLICATE_SLUG", "Já existe uma formação com este slug.", 409);
  }

  const payload: Record<string, unknown> = {
    title: parsed.data.title,
    slug,
    summary: parsed.data.summary ?? null,
    audience: parsed.data.audience ?? null,
    outcomes: parsed.data.outcomes ?? [],
    finalProject: parsed.data.finalProject ?? null,
    prerequisites: parsed.data.prerequisites ?? null,
    order: parsed.data.order ?? existing.order,
    isActive: parsed.data.isActive ?? existing.isActive,
  };
  if (parsed.data.courseIds !== undefined) {
    payload.courseIds = parsed.data.courseIds;
  }

  if (await enqueueIfAdmin(user, "site_formation", "update", id, payload, formationPrevious(existing))) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }

  await prisma.siteFormation.update({
    where: { id },
    data: {
      title: payload.title as string,
      slug: payload.slug as string,
      summary: payload.summary as string | null,
      audience: payload.audience as string | null,
      outcomes: payload.outcomes as string[],
      finalProject: payload.finalProject as string | null,
      prerequisites: payload.prerequisites as string | null,
      order: payload.order as number,
      isActive: payload.isActive as boolean,
    },
  });

  if (parsed.data.courseIds !== undefined) {
    const courseIds = parsed.data.courseIds;
    await prisma.$transaction([
      prisma.siteFormationCourse.deleteMany({ where: { formationId: id } }),
      ...(courseIds.length
        ? [
            prisma.siteFormationCourse.createMany({
              data: courseIds.map((courseId, index) => ({
                formationId: id,
                courseId,
                order: index,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
  }

  const item = await prisma.siteFormation.findUnique({
    where: { id },
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  return jsonOk({ item });
}

export async function DELETE(_r: Request, ctx: Ctx) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await ctx.params;
  const existing = await prisma.siteFormation.findUnique({
    where: { id },
    include: { courses: { orderBy: [{ order: "asc" }] } },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Formação não encontrada.", 404);
  if (await enqueueIfAdmin(user, "site_formation", "delete", id, {}, formationPrevious(existing))) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  await prisma.siteFormation.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
