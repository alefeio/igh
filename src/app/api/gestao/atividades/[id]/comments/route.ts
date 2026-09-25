import { boardApiErrorResponse } from "@/lib/board-activities-http";
import { assertCanOpenActivity, requireBoardAccess, resolvePilotUnitOrThrow } from "@/lib/board-activities-server";
import { createUserNotificationIfNew } from "@/lib/user-notifications";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { boardCommentSchema } from "@/lib/validators/board-activities";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireBoardAccess();
    const unit = await resolvePilotUnitOrThrow();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = boardCommentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }

    const task = await prisma.boardActivity.findFirst({
      where: { id, unitId: unit.id, archivedAt: null },
      select: {
        id: true,
        title: true,
        creatorId: true,
        assigneeId: true,
        isPrivate: true,
        assignees: { select: { userId: true } },
      },
    });
    if (!task) return jsonErr("NOT_FOUND", "Atividade não encontrada.", 404);
    assertCanOpenActivity(task, user.id);

    const comment = await prisma.boardActivityComment.create({
      data: {
        taskId: task.id,
        authorId: user.id,
        body: parsed.data.body,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    const notifyIds = new Set([task.creatorId, task.assigneeId, ...task.assignees.map((row) => row.userId)]);
    notifyIds.delete(user.id);
    for (const uid of notifyIds) {
      await createUserNotificationIfNew({
        userId: uid,
        kind: "BOARD_ACTIVITY_COMMENT",
        title: "Novo comentário em atividade",
        body: task.title,
        linkUrl: `/gestao/atividades?task=${task.id}`,
        dedupeKey: `board-comment:${comment.id}:${uid}`,
      });
    }

    return jsonOk(
      {
        comment: {
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
          author: comment.author,
          canEdit: true,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
