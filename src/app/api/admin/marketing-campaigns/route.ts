import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const items = await prisma.marketingCampaign.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      isActive: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      _count: { select: { responses: true } },
    },
  });
  return jsonOk({
    items: items.map((c) => ({
      ...c,
      startsAt: c.startsAt ? c.startsAt.toISOString() : null,
      endsAt: c.endsAt ? c.endsAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      responsesCount: c._count.responses,
    })),
  });
}

export async function POST(request: Request) {
  await requireRole(["MASTER", "ADMIN"]);
  const body = await request.json().catch(() => null);

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  if (!title) return jsonErr("VALIDATION_ERROR", "Título é obrigatório.", 400);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return jsonErr("VALIDATION_ERROR", "Slug inválido (use minúsculas, números e hífens).", 400);
  }

  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const isActive = body?.isActive !== false;
  const startsAt = typeof body?.startsAt === "string" && body.startsAt ? new Date(body.startsAt) : null;
  const endsAt = typeof body?.endsAt === "string" && body.endsAt ? new Date(body.endsAt) : null;

  try {
    const item = await prisma.marketingCampaign.create({
      data: {
        title,
        slug,
        description: description.length ? description : null,
        isActive,
        startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null,
        endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
      },
      select: { id: true },
    });
    return jsonOk({ id: item.id }, { status: 201 });
  } catch {
    return jsonErr("DUPLICATE_SLUG", "Slug em uso.", 409);
  }
}

