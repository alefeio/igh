import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteFormationCourseSchema, siteFormationReorderSchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id: formationId } = await ctx.params;
  const formation = await prisma.siteFormation.findUnique({
    where: { id: formationId },
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  if (!formation) return jsonErr("NOT_FOUND", "Formação não encontrada.", 404);
  return jsonOk({ formation, courses: formation.courses });
}

export async function POST(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id: formationId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteFormationCourseSchema.safeParse({ ...body, formationId });
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const formation = await prisma.siteFormation.findUnique({ where: { id: formationId } });
  if (!formation) return jsonErr("NOT_FOUND", "Formação não encontrada.", 404);
  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) return jsonErr("NOT_FOUND", "Curso não encontrado.", 404);
  const existing = await prisma.siteFormationCourse.findUnique({
    where: { formationId_courseId: { formationId, courseId: parsed.data.courseId } },
  });
  if (existing) return jsonErr("DUPLICATE", "Este curso já está vinculado à formação.", 409);
  const maxOrder = await prisma.siteFormationCourse.aggregate({
    _max: { order: true },
    where: { formationId },
  });
  await prisma.siteFormationCourse.create({
    data: {
      formationId,
      courseId: parsed.data.courseId,
      order: parsed.data.order ?? (maxOrder._max.order ?? -1) + 1,
    },
  });
  const updated = await prisma.siteFormation.findUnique({
    where: { id: formationId },
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  return jsonOk({ formation: updated, courses: updated?.courses ?? [] }, { status: 201 });
}

export async function PATCH(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id: formationId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteFormationReorderSchema.safeParse({ ...body, formationId });
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }
  const formation = await prisma.siteFormation.findUnique({ where: { id: formationId } });
  if (!formation) return jsonErr("NOT_FOUND", "Formação não encontrada.", 404);
  await prisma.$transaction(
    parsed.data.courseIds.map((courseId, index) =>
      prisma.siteFormationCourse.updateMany({
        where: { formationId, courseId },
        data: { order: index },
      })
    )
  );
  const updated = await prisma.siteFormation.findUnique({
    where: { id: formationId },
    include: { courses: { include: { course: true }, orderBy: [{ order: "asc" }] } },
  });
  return jsonOk({ formation: updated, courses: updated?.courses ?? [] });
}

export async function DELETE(request: Request, ctx: Ctx) {
  await requireRole("MASTER");
  const { id: formationId } = await ctx.params;
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");
  if (!courseId) return jsonErr("VALIDATION_ERROR", "courseId é obrigatório.", 400);
  const existing = await prisma.siteFormationCourse.findUnique({
    where: { formationId_courseId: { formationId, courseId } },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Vínculo não encontrado.", 404);
  await prisma.siteFormationCourse.delete({
    where: { formationId_courseId: { formationId, courseId } },
  });
  return jsonOk({ deleted: true });
}
