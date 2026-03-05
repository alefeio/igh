import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { siteTransparencyDocumentSchema } from "@/lib/validators/site";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  await requireRole(["ADMIN", "MASTER"]);
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = siteTransparencyDocumentSchema.safeParse(body);
  if (!parsed.success) return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  const existing = await prisma.siteTransparencyDocument.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Documento nao encontrado.", 404);
  const item = await prisma.siteTransparencyDocument.update({
    where: { id },
    data: {
      categoryId: parsed.data.categoryId ?? undefined,
      title: parsed.data.title,
      description: parsed.data.description ?? undefined,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      fileUrl: parsed.data.fileUrl === "" ? null : (parsed.data.fileUrl ?? undefined),
      isActive: parsed.data.isActive ?? undefined,
    },
    include: { category: true },
  });
  return jsonOk({ item });
}

export async function DELETE(_r: Request, ctx: Ctx) {
  await requireRole("MASTER");
  const { id } = await ctx.params;
  const existing = await prisma.siteTransparencyDocument.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Documento nao encontrado.", 404);
  await prisma.siteTransparencyDocument.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
