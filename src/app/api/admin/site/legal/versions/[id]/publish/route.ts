import { requireStaffWrite } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-auth-guard";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/** Publica esta versão e arquiva a anterior publicada do mesmo tipo. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaffWrite();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }
  const { id } = await ctx.params;

  const draft = await prisma.legalDocumentVersion.findUnique({
    where: { id },
    select: { id: true, kind: true, status: true, contentRich: true },
  });
  if (!draft) {
    return jsonErr("NOT_FOUND", "Versão não encontrada.", 404);
  }
  if (draft.status !== "DRAFT") {
    return jsonErr("FORBIDDEN", "Só é possível publicar rascunhos.", 400);
  }
  if (!draft.contentRich?.trim() || draft.contentRich.trim() === "<p></p>") {
    return jsonErr("VALIDATION_ERROR", "Preencha o conteúdo antes de publicar.", 400);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.legalDocumentVersion.updateMany({
      where: { kind: draft.kind, status: "PUBLISHED" },
      data: { status: "ARCHIVED" },
    });
    await tx.legalDocumentVersion.update({
      where: { id: draft.id },
      data: { status: "PUBLISHED", publishedAt: now },
    });
  });

  const row = await prisma.legalDocumentVersion.findUnique({
    where: { id: draft.id },
    select: {
      id: true,
      kind: true,
      versionLabel: true,
      title: true,
      status: true,
      publishedAt: true,
    },
  });

  return jsonOk({ item: row });
}
