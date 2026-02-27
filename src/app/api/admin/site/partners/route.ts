import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { sitePartnerSchema, reorderSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  const items = await prisma.sitePartner.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = sitePartnerSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const max = await prisma.sitePartner.aggregate({ _max: { order: true } });
  const item = await prisma.sitePartner.create({
    data: {
      name: parsed.data.name,
      logoUrl: parsed.data.logoUrl || null,
      websiteUrl: parsed.data.websiteUrl || null,
      order: parsed.data.order ?? (max._max.order ?? -1) + 1,
      isActive: parsed.data.isActive ?? true,
    },
  });
  return jsonOk({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  await prisma.$transaction(
    parsed.data.ids.map((id, i) => prisma.sitePartner.update({ where: { id }, data: { order: i } }))
  );
  const items = await prisma.sitePartner.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
