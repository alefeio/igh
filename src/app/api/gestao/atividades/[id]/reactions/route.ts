import { boardApiErrorResponse } from "@/lib/board-activities-http";
import { assertCanOpenActivity, requireBoardAccess, resolvePilotUnitOrThrow } from "@/lib/board-activities-server";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { boardReactionSchema } from "@/lib/validators/board-activities";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireBoardAccess();
    const unit = await resolvePilotUnitOrThrow();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = boardReactionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }

    const task = await prisma.boardActivity.findFirst({
      where: { id, unitId: unit.id, archivedAt: null },
      select: {
        id: true,
        creatorId: true,
        assigneeId: true,
        isPrivate: true,
        assignees: { select: { userId: true } },
      },
    });
    if (!task) return jsonErr("NOT_FOUND", "Atividade não encontrada.", 404);
    assertCanOpenActivity(task, user.id);

    const existing = await prisma.boardActivityReaction.findUnique({
      where: {
        taskId_userId_emoji: {
          taskId: id,
          userId: user.id,
          emoji: parsed.data.emoji,
        },
      },
    });

    if (existing) {
      await prisma.boardActivityReaction.delete({ where: { id: existing.id } });
      return jsonOk({ removed: true, emoji: parsed.data.emoji });
    }

    await prisma.boardActivityReaction.create({
      data: { taskId: id, userId: user.id, emoji: parsed.data.emoji },
    });
    return jsonOk({ added: true, emoji: parsed.data.emoji }, { status: 201 });
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
