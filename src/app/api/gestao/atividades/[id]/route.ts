import { boardApiErrorResponse } from "@/lib/board-activities-http";
import {
  belemDayStartUtc,
  canEditBoardActivityMain,
  canMoveBoardActivity,
  canTransitionStatus,
  isActivityOverdue,
  parseIsoDateOnly,
  applyStatusSideEffects,
} from "@/lib/board-activities";
import {
  assertAssigneeEligible,
  canAdminReassign,
  requireBoardAccess,
  resolvePilotUnitOrThrow,
} from "@/lib/board-activities-server";
import { createUserNotificationIfNew } from "@/lib/user-notifications";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  boardReassignSchema,
  moveBoardActivitySchema,
  updateBoardActivitySchema,
} from "@/lib/validators/board-activities";

type Ctx = { params: Promise<{ id: string }> };

async function loadTask(id: string, unitId: string) {
  return prisma.boardActivity.findFirst({
    where: { id, unitId, archivedAt: null },
    include: {
      creator: { select: { id: true, name: true, email: true, isActive: true } },
      assignee: { select: { id: true, name: true, email: true, isActive: true } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 200,
        include: { author: { select: { id: true, name: true } } },
      },
      reactions: {
        include: { user: { select: { id: true, name: true } } },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { id: true, name: true } } },
      },
      _count: {
        select: {
          comments: { where: { deletedAt: null } },
          reactions: true,
        },
      },
    },
  });
}

function serializeDetail(
  task: NonNullable<Awaited<ReturnType<typeof loadTask>>>,
  currentUserId: string,
) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    plannedStartAt: task.plannedStartAt.toISOString(),
    plannedEndAt: task.plannedEndAt?.toISOString() ?? null,
    startedAt: task.startedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    version: task.version,
    creator: task.creator,
    assignee: task.assignee,
    overdue: isActivityOverdue({
      status: task.status,
      plannedStartAt: task.plannedStartAt,
      plannedEndAt: task.plannedEndAt,
    }),
    canMove: canMoveBoardActivity({
      actorId: currentUserId,
      creatorId: task.creatorId,
      assigneeId: task.assigneeId,
    }),
    canEdit: canEditBoardActivityMain({
      actorId: currentUserId,
      creatorId: task.creatorId,
    }),
    comments: task.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      author: c.author,
      canEdit: c.authorId === currentUserId,
    })),
    reactions: task.reactions.map((r) => ({
      id: r.id,
      emoji: r.emoji,
      userId: r.userId,
      userName: r.user.name,
      mine: r.userId === currentUserId,
    })),
    events: task.events.map((e) => ({
      id: e.id,
      type: e.type,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
      actor: e.actor,
    })),
    commentCount: task._count.comments,
    reactionCount: task._count.reactions,
  };
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requireBoardAccess();
    const unit = await resolvePilotUnitOrThrow();
    const { id } = await ctx.params;
    const task = await loadTask(id, unit.id);
    if (!task) return jsonErr("NOT_FOUND", "Atividade não encontrada.", 404);
    return jsonOk({ activity: serializeDetail(task, user.id) });
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const user = await requireBoardAccess();
    const unit = await resolvePilotUnitOrThrow();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);

    // Move status
    if (body && typeof body === "object" && "status" in body && !("title" in body)) {
      const parsed = moveBoardActivitySchema.safeParse(body);
      if (!parsed.success) {
        return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
      }
      const existing = await prisma.boardActivity.findFirst({
        where: { id, unitId: unit.id, archivedAt: null },
      });
      if (!existing) return jsonErr("NOT_FOUND", "Atividade não encontrada.", 404);
      if (
        !canMoveBoardActivity({
          actorId: user.id,
          creatorId: existing.creatorId,
          assigneeId: existing.assigneeId,
        })
      ) {
        return jsonErr("FORBIDDEN", "Somente quem criou ou o responsável pode mudar o status.", 403);
      }
      if (!canTransitionStatus(existing.status, parsed.data.status)) {
        return jsonErr("VALIDATION_ERROR", "Essa mudança de situação não é permitida.", 400);
      }
      if (parsed.data.version != null && parsed.data.version !== existing.version) {
        return jsonErr("CONFLICT", "A atividade foi atualizada por outra pessoa. Recarregue.", 409);
      }

      const side = applyStatusSideEffects(existing.status, parsed.data.status);
      const eventType =
        existing.status === "DONE" && parsed.data.status === "IN_PROGRESS"
          ? ("REOPENED" as const)
          : ("STATUS_CHANGED" as const);

      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.boardActivity.update({
          where: { id: existing.id },
          data: {
            status: parsed.data.status,
            version: { increment: 1 },
            ...(side.startedAt !== undefined
              ? {
                  startedAt:
                    existing.startedAt && parsed.data.status === "IN_PROGRESS" && existing.status === "DONE"
                      ? existing.startedAt
                      : side.startedAt === null
                        ? null
                        : side.startedAt ?? existing.startedAt,
                }
              : {}),
            ...(side.completedAt !== undefined ? { completedAt: side.completedAt } : {}),
            ...(parsed.data.status === "IN_PROGRESS" && !existing.startedAt
              ? { startedAt: side.startedAt ?? new Date() }
              : {}),
          },
        });
        await tx.boardActivityEvent.create({
          data: {
            taskId: existing.id,
            actorId: user.id,
            type: eventType,
            payload: { from: existing.status, to: parsed.data.status },
          },
        });
        return row;
      });

      return jsonOk({
        activity: {
          id: updated.id,
          status: updated.status,
          version: updated.version,
          startedAt: updated.startedAt?.toISOString() ?? null,
          completedAt: updated.completedAt?.toISOString() ?? null,
        },
      });
    }

    // Edit main fields
    const parsed = updateBoardActivitySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }
    const existing = await prisma.boardActivity.findFirst({
      where: { id, unitId: unit.id, archivedAt: null },
    });
    if (!existing) return jsonErr("NOT_FOUND", "Atividade não encontrada.", 404);
    if (!canEditBoardActivityMain({ actorId: user.id, creatorId: existing.creatorId })) {
      return jsonErr("FORBIDDEN", "Somente quem criou a atividade pode editá-la.", 403);
    }
    if (parsed.data.version != null && parsed.data.version !== existing.version) {
      return jsonErr("CONFLICT", "A atividade foi atualizada por outra pessoa. Recarregue.", 409);
    }

    if (parsed.data.assigneeId) await assertAssigneeEligible(parsed.data.assigneeId);

    let plannedStartAt = existing.plannedStartAt;
    let plannedEndAt = existing.plannedEndAt;
    if (parsed.data.plannedStartAt) {
      const p = parseIsoDateOnly(parsed.data.plannedStartAt)!;
      plannedStartAt = belemDayStartUtc(p.y, p.m, p.d);
    }
    if (parsed.data.plannedEndAt === null) {
      plannedEndAt = plannedStartAt;
    } else if (parsed.data.plannedEndAt) {
      const p = parseIsoDateOnly(parsed.data.plannedEndAt)!;
      plannedEndAt = belemDayStartUtc(p.y, p.m, p.d);
    }
    if (plannedEndAt && plannedEndAt.getTime() < plannedStartAt.getTime()) {
      return jsonErr("VALIDATION_ERROR", "A data final não pode ser anterior à inicial.", 400);
    }

    const assigneeChanged =
      parsed.data.assigneeId != null && parsed.data.assigneeId !== existing.assigneeId;
    const periodChanged =
      parsed.data.plannedStartAt != null || parsed.data.plannedEndAt !== undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.boardActivity.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.title != null ? { title: parsed.data.title } : {}),
          ...(parsed.data.description !== undefined
            ? { description: parsed.data.description }
            : {}),
          ...(parsed.data.assigneeId ? { assigneeId: parsed.data.assigneeId } : {}),
          plannedStartAt,
          plannedEndAt,
          version: { increment: 1 },
        },
      });
      if (assigneeChanged) {
        await tx.boardActivityEvent.create({
          data: {
            taskId: existing.id,
            actorId: user.id,
            type: "ASSIGNEE_CHANGED",
            payload: { from: existing.assigneeId, to: parsed.data.assigneeId },
          },
        });
      }
      if (periodChanged) {
        await tx.boardActivityEvent.create({
          data: {
            taskId: existing.id,
            actorId: user.id,
            type: "PLANNED_PERIOD_CHANGED",
            payload: {
              plannedStartAt: plannedStartAt.toISOString(),
              plannedEndAt: plannedEndAt?.toISOString() ?? null,
            },
          },
        });
      }
      return row;
    });

    if (assigneeChanged && parsed.data.assigneeId && parsed.data.assigneeId !== user.id) {
      await createUserNotificationIfNew({
        userId: parsed.data.assigneeId,
        kind: "BOARD_ACTIVITY_ASSIGNED",
        title: "Atividade atribuída a você",
        body: updated.title,
        linkUrl: `/gestao/atividades?task=${updated.id}`,
        dedupeKey: `board-reassign:${updated.id}:${parsed.data.assigneeId}:${updated.version}`,
      });
    }

    const detail = await loadTask(updated.id, unit.id);
    return jsonOk({ activity: detail ? serializeDetail(detail, user.id) : null });
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

/** Arquivar (criador) ou reassociar (admin). */
export async function POST(request: Request, ctx: Ctx) {
  try {
    const user = await requireBoardAccess();
    const unit = await resolvePilotUnitOrThrow();
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => null)) as { action?: string } | null;
    const action = body?.action;

    const existing = await prisma.boardActivity.findFirst({
      where: { id, unitId: unit.id },
    });
    if (!existing) return jsonErr("NOT_FOUND", "Atividade não encontrada.", 404);

    if (action === "archive") {
      if (!canEditBoardActivityMain({ actorId: user.id, creatorId: existing.creatorId })) {
        return jsonErr("FORBIDDEN", "Somente quem criou pode arquivar.", 403);
      }
      if (existing.status !== "DONE") {
        return jsonErr("VALIDATION_ERROR", "Só é possível arquivar atividades concluídas.", 400);
      }
      await prisma.$transaction(async (tx) => {
        await tx.boardActivity.update({
          where: { id },
          data: { archivedAt: new Date(), version: { increment: 1 } },
        });
        await tx.boardActivityEvent.create({
          data: { taskId: id, actorId: user.id, type: "ARCHIVED", payload: {} },
        });
      });
      return jsonOk({ archived: true });
    }

    if (action === "reassign") {
      if (!canAdminReassign(user)) {
        return jsonErr("FORBIDDEN", "Somente Master/Admin pode reassociar.", 403);
      }
      const parsed = boardReassignSchema.safeParse(body);
      if (!parsed.success) {
        return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
      }
      if (!parsed.data.assigneeId && !parsed.data.creatorId) {
        return jsonErr("VALIDATION_ERROR", "Informe o novo responsável ou criador.", 400);
      }
      if (parsed.data.assigneeId) await assertAssigneeEligible(parsed.data.assigneeId);
      if (parsed.data.creatorId) await assertAssigneeEligible(parsed.data.creatorId);

      await prisma.$transaction(async (tx) => {
        await tx.boardActivity.update({
          where: { id },
          data: {
            ...(parsed.data.assigneeId ? { assigneeId: parsed.data.assigneeId } : {}),
            ...(parsed.data.creatorId ? { creatorId: parsed.data.creatorId } : {}),
            version: { increment: 1 },
          },
        });
        await tx.boardActivityEvent.create({
          data: {
            taskId: id,
            actorId: user.id,
            type: "ADMIN_REASSIGNED",
            payload: {
              assigneeId: parsed.data.assigneeId ?? null,
              creatorId: parsed.data.creatorId ?? null,
              reason: parsed.data.reason ?? null,
            },
          },
        });
      });
      return jsonOk({ reassigned: true });
    }

    return jsonErr("VALIDATION_ERROR", "Ação inválida.", 400);
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
