import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteTransparencyDocumentSchema } from "@/lib/validators/site";

export async function GET(request: Request) {
  await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") || undefined;
  const items = await prisma.siteTransparencyDocument.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { category: true },
  });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const body = await request.json().catch(() => null);
  const parsed = siteTransparencyDocumentSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const category = await prisma.siteTransparencyCategory.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) return jsonErr("NOT_FOUND", "Categoria nao encontrada.", 404);
  const payload = {
    categoryId: parsed.data.categoryId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    date: parsed.data.date ?? null,
    fileUrl: parsed.data.fileUrl || null,
    isActive: parsed.data.isActive ?? true,
  };
  if (await enqueueIfAdmin(user, "site_transparency_document", "create", null, payload)) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE }, { status: 201 });
  }
  const item = await prisma.siteTransparencyDocument.create({
    data: {
      ...payload,
      date: payload.date ? new Date(payload.date) : null,
    },
    include: { category: true },
  });
  return jsonOk({ item }, { status: 201 });
}
