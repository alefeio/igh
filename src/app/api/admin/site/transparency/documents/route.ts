import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteTransparencyDocumentSchema } from "@/lib/validators/site";

export async function GET(request: Request) {
  await requireRole(["ADMIN", "MASTER"]);
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
  await requireRole(["ADMIN", "MASTER"]);
  const body = await request.json().catch(() => null);
  const parsed = siteTransparencyDocumentSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const category = await prisma.siteTransparencyCategory.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) return jsonErr("NOT_FOUND", "Categoria nao encontrada.", 404);
  const item = await prisma.siteTransparencyDocument.create({
    data: {
      categoryId: parsed.data.categoryId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
      fileUrl: parsed.data.fileUrl || null,
      isActive: parsed.data.isActive ?? true,
    },
    include: { category: true },
  });
  return jsonOk({ item }, { status: 201 });
}
