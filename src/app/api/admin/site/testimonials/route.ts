import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteTestimonialSchema, reorderSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  const items = await prisma.siteTestimonial.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = siteTestimonialSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados invalidos", 400);
  const maxOrder = await prisma.siteTestimonial.aggregate({ _max: { order: true } });
  const item = await prisma.siteTestimonial.create({
    data: {
      name: parsed.data.name,
      roleOrContext: parsed.data.roleOrContext ?? null,
      quote: parsed.data.quote,
      photoUrl: parsed.data.photoUrl || null,
      order: parsed.data.order ?? (maxOrder._max.order ?? -1) + 1,
      isActive: parsed.data.isActive ?? true,
    },
  });
  return jsonOk({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados invalidos", 400);
  await prisma.$transaction(
    parsed.data.ids.map((id, i) => prisma.siteTestimonial.update({ where: { id }, data: { order: i } }))
  );
  const items = await prisma.siteTestimonial.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
