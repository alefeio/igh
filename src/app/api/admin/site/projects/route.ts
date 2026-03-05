import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { createPendingSiteChange } from "@/lib/pending-site-change";
import { siteProjectSchema, reorderSchema } from "@/lib/validators/site";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  const items = await prisma.siteProject.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = siteProjectSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const slugVal = parsed.data.slug || slug(parsed.data.title);
  if (await prisma.siteProject.findUnique({ where: { slug: slugVal } }))
    return jsonErr("DUPLICATE_SLUG", "Slug em uso.", 409);
  const max = await prisma.siteProject.aggregate({ _max: { order: true } });
  const payload = {
    title: parsed.data.title,
    slug: slugVal,
    summary: parsed.data.summary ?? null,
    content: parsed.data.content ?? null,
    coverImageUrl: parsed.data.coverImageUrl || null,
    galleryImages: parsed.data.galleryImages ?? [],
    order: parsed.data.order ?? (max._max.order ?? -1) + 1,
    isActive: parsed.data.isActive ?? true,
  };
  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_project", "create", null, payload);
    return jsonOk({ pending: true, message: "Alteração enviada para aprovação do Master." }, { status: 201 });
  }
  const item = await prisma.siteProject.create({ data: payload });
  return jsonOk({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  if (user.role === "ADMIN") {
    await createPendingSiteChange(user.id, "site_project_reorder", "update", null, { ids: parsed.data.ids });
    return jsonOk({ pending: true, message: "Alteração enviada para aprovação do Master." });
  }
  await prisma.$transaction(
    parsed.data.ids.map((id, i) => prisma.siteProject.update({ where: { id }, data: { order: i } }))
  );
  const items = await prisma.siteProject.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
