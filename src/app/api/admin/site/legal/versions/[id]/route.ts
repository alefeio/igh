import { requireStaffWrite } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().max(500).optional(),
  contentRich: z.string().max(2_000_000).optional(),
});

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffWrite();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }
  const { id } = await ctx.params;
  const row = await prisma.legalDocumentVersion.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      versionLabel: true,
      title: true,
      contentRich: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });
  if (!row) {
    return jsonErr("NOT_FOUND", "Versão não encontrada.", 404);
  }
  return jsonOk({ item: row });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffWrite();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }
  const { id } = await ctx.params;
  const raw = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.legalDocumentVersion.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Versão não encontrada.", 404);
  }
  if (existing.status !== "DRAFT") {
    return jsonErr("FORBIDDEN", "Só é possível editar rascunhos.", 400);
  }

  const data: { title?: string; contentRich?: string } = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title.trim();
  if (parsed.data.contentRich !== undefined) data.contentRich = parsed.data.contentRich;

  const row = await prisma.legalDocumentVersion.update({
    where: { id },
    data,
    select: {
      id: true,
      kind: true,
      versionLabel: true,
      title: true,
      contentRich: true,
      status: true,
      updatedAt: true,
    },
  });

  return jsonOk({ item: row });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffWrite();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }
  const { id } = await ctx.params;
  const existing = await prisma.legalDocumentVersion.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) {
    return jsonErr("NOT_FOUND", "Versão não encontrada.", 404);
  }
  if (existing.status !== "DRAFT") {
    return jsonErr("FORBIDDEN", "Só é possível excluir rascunhos.", 400);
  }
  await prisma.legalDocumentVersion.delete({ where: { id } });
  return jsonOk({ deleted: true });
}
