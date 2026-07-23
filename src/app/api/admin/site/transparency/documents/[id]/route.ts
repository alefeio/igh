import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { enqueueIfAdmin, PENDING_SITE_CHANGE_MESSAGE } from "@/lib/pending-site-change";
import { siteTransparencyDocumentUpdateSchema } from "@/lib/validators/site";

function documentPrevious(existing: {
  categoryId: string;
  title: string;
  description: string | null;
  date: Date | null;
  fileUrl: string | null;
  isActive: boolean;
}) {
  return {
    categoryId: existing.categoryId,
    title: existing.title,
    description: existing.description,
    date: existing.date ? existing.date.toISOString() : null,
    fileUrl: existing.fileUrl,
    isActive: existing.isActive,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await context.params;

  const existing = await prisma.siteTransparencyDocument.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Documento não encontrado.", 404);

  const body = await request.json().catch(() => null);
  const parsed = siteTransparencyDocumentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Erro", 400);
  }

  const d = parsed.data;
  if (d.categoryId !== undefined) {
    const category = await prisma.siteTransparencyCategory.findUnique({ where: { id: d.categoryId } });
    if (!category) return jsonErr("NOT_FOUND", "Categoria nao encontrada.", 404);
  }

  const payload: Record<string, unknown> = {};
  if (d.categoryId !== undefined) payload.categoryId = d.categoryId;
  if (d.title !== undefined) payload.title = d.title;
  if (d.description !== undefined) payload.description = d.description ?? null;
  if (d.date !== undefined) payload.date = d.date ?? null;
  if (d.fileUrl !== undefined) payload.fileUrl = d.fileUrl || null;
  if (d.isActive !== undefined) payload.isActive = d.isActive;

  if (Object.keys(payload).length === 0) {
    return jsonErr("VALIDATION_ERROR", "Nenhum campo para atualizar.", 400);
  }

  if (
    await enqueueIfAdmin(
      user,
      "site_transparency_document",
      "update",
      id,
      payload,
      documentPrevious(existing)
    )
  ) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }

  const data: {
    categoryId?: string;
    title?: string;
    description?: string | null;
    date?: Date | null;
    fileUrl?: string | null;
    isActive?: boolean;
  } = {};

  if (d.categoryId !== undefined) data.categoryId = d.categoryId;
  if (d.title !== undefined) data.title = d.title;
  if (d.description !== undefined) data.description = d.description ?? null;
  if (d.date !== undefined) data.date = d.date ? new Date(d.date) : null;
  if (d.fileUrl !== undefined) data.fileUrl = d.fileUrl || null;
  if (d.isActive !== undefined) data.isActive = d.isActive;

  const item = await prisma.siteTransparencyDocument.update({
    where: { id },
    data,
    include: { category: true },
  });

  return jsonOk({ item });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(["ADMIN", "MASTER", "COORDINATOR"]);
  const { id } = await context.params;

  const existing = await prisma.siteTransparencyDocument.findUnique({ where: { id } });
  if (!existing) return jsonErr("NOT_FOUND", "Documento não encontrado.", 404);

  if (
    await enqueueIfAdmin(
      user,
      "site_transparency_document",
      "delete",
      id,
      {},
      documentPrevious(existing)
    )
  ) {
    return jsonOk({ pending: true, message: PENDING_SITE_CHANGE_MESSAGE });
  }

  await prisma.siteTransparencyDocument.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
