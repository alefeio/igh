import { boardApiErrorResponse } from "@/lib/board-activities-http";
import { requireBoardAccess, resolvePilotUnitOrThrow } from "@/lib/board-activities-server";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { boardCommentSchema } from "@/lib/validators/board-activities";

type Ctx = { params: Promise<{ id: string; commentId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireBoardAccess();
    const unit = await resolvePilotUnitOrThrow();
    const { id, commentId } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = boardCommentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }

    const task = await prisma.boardActivity.findFirst({
      where: { id, unitId: unit.id },
      select: { id: true },
    });
    if (!task) return jsonErr("NOT_FOUND", "Atividade não encontrada.", 404);

    const comment = await prisma.boardActivityComment.findFirst({
      where: { id: commentId, taskId: id, deletedAt: null },
    });
    if (!comment) return jsonErr("NOT_FOUND", "Comentário não encontrado.", 404);
    if (comment.authorId !== user.id) {
      return jsonErr("FORBIDDEN", "Só o autor pode editar o comentário.", 403);
    }

    const updated = await prisma.boardActivityComment.update({
      where: { id: commentId },
      data: { body: parsed.data.body },
      include: { author: { select: { id: true, name: true } } },
    });

    return jsonOk({
      comment: {
        id: updated.id,
        body: updated.body,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        author: updated.author,
        canEdit: true,
      },
    });
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const user = await requireBoardAccess();
    const unit = await resolvePilotUnitOrThrow();
    const { id, commentId } = await ctx.params;

    const task = await prisma.boardActivity.findFirst({
      where: { id, unitId: unit.id },
      select: { id: true },
    });
    if (!task) return jsonErr("NOT_FOUND", "Atividade não encontrada.", 404);

    const comment = await prisma.boardActivityComment.findFirst({
      where: { id: commentId, taskId: id, deletedAt: null },
    });
    if (!comment) return jsonErr("NOT_FOUND", "Comentário não encontrado.", 404);
    if (comment.authorId !== user.id) {
      return jsonErr("FORBIDDEN", "Só o autor pode remover o comentário.", 403);
    }

    await prisma.boardActivityComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
    return jsonOk({ deleted: true });
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
