import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteFaqItemSchema, reorderSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER"]);
  const items = await prisma.siteFaqItem.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = siteFaqItemSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const max = await prisma.siteFaqItem.aggregate({ _max: { order: true } });
  const item = await prisma.siteFaqItem.create({
    data: {
      question: parsed.data.question,
      answer: parsed.data.answer,
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
    parsed.data.ids.map((id, i) => prisma.siteFaqItem.update({ where: { id }, data: { order: i } }))
  );
  const items = await prisma.siteFaqItem.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
