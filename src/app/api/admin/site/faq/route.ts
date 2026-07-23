import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteFaqItemSchema, reorderSchema } from "@/lib/validators/site";

export async function GET() {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const items = await prisma.siteFaqItem.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = siteFaqItemSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const max = await prisma.siteFaqItem.aggregate({ _max: { order: true } });
  const payload = {
    question: parsed.data.question,
    answer: parsed.data.answer,
    order: parsed.data.order ?? (max._max.order ?? -1) + 1,
    isActive: parsed.data.isActive ?? true,
  };
  if (await enqueueIfAdmin(user, "site_faq_item", "create", null, payload)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE }, { status: 201 });
  }
  const item = await prisma.siteFaqItem.create({ data: payload });
  return jsonOk({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const current = await prisma.siteFaqItem.findMany({
    orderBy: [{ order: "asc" }],
    select: { id: true },
  });
  const previous = { ids: current.map((i) => i.id) };
  if (await enqueueIfAdmin(user, "site_faq_item", "update", null, { ids: parsed.data.ids }, previous)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }
  await prisma.$transaction(
    parsed.data.ids.map((id, i) => prisma.siteFaqItem.update({ where: { id }, data: { order: i } }))
  );
  const items = await prisma.siteFaqItem.findMany({ orderBy: [{ order: "asc" }] });
  return jsonOk({ items });
}
