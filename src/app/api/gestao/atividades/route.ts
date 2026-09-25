import { boardApiErrorResponse } from "@/lib/board-activities-http";
import {
  belemDayStartUtc,
  initialStatusOnCreate,
  isActivityOverdue,
  parseIsoDateOnly,
  resolveBoardPeriod,
} from "@/lib/board-activities";
import {
  assertAssigneeEligible,
  boardActivityListWhere,
  requireBoardAccess,
  requireBoardCreatePermission,
  resolvePilotUnitOrThrow,
} from "@/lib/board-activities-server";
import { createUserNotificationIfNew } from "@/lib/user-notifications";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { createBoardActivitySchema } from "@/lib/validators/board-activities";

function mapCard(row: {
  id: string;
  title: string;
  status: "PLANNED" | "IN_PROGRESS" | "DONE";
  plannedStartAt: Date;
  plannedEndAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  creatorId: string;
  assigneeId: string;
  version: number;
  createdAt: Date;
  assignee: { id: string; name: string };
  _count: { comments: number; reactions: number };
}) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    plannedStartAt: row.plannedStartAt.toISOString(),
    plannedEndAt: row.plannedEndAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    creatorId: row.creatorId,
    assigneeId: row.assigneeId,
    assignee: row.assignee,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    commentCount: row._count.comments,
    reactionCount: row._count.reactions,
    overdue: isActivityOverdue({
      status: row.status,
      plannedStartAt: row.plannedStartAt,
      plannedEndAt: row.plannedEndAt,
    }),
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireBoardAccess();
    const unit = await resolvePilotUnitOrThrow();
    const url = new URL(request.url);
    const period = resolveBoardPeriod({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    if (!period.ok) return jsonErr("VALIDATION_ERROR", period.message, 400);

    const mine = url.searchParams.get("mine") === "1";
    const assigneeId = url.searchParams.get("assigneeId");
    const q = url.searchParams.get("q");

    const where = boardActivityListWhere({
      unitId: unit.id,
      fromUtc: period.range.fromUtc,
      toExclusiveUtc: period.range.toExclusiveUtc,
      mineUserId: mine ? user.id : null,
      assigneeId: assigneeId || null,
      q,
    });

    const rows = await prisma.boardActivity.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        _count: {
          select: {
            comments: { where: { deletedAt: null } },
            reactions: true,
          },
        },
      },
      orderBy: [{ plannedStartAt: "asc" }, { createdAt: "asc" }],
      take: 500,
    });

    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { canCreateBoardTasks: true },
    });

    return jsonOk({
      unit: { id: unit.id, name: unit.name },
      period: { from: period.range.from, to: period.range.to },
      canCreate: Boolean(me?.canCreateBoardTasks),
      currentUserId: user.id,
      activities: rows.map(mapCard),
    });
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireBoardAccess();
    await requireBoardCreatePermission(user);
    const unit = await resolvePilotUnitOrThrow();

    const body = await request.json().catch(() => null);
    const parsed = createBoardActivitySchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }

    await assertAssigneeEligible(parsed.data.assigneeId);

    const startParts = parseIsoDateOnly(parsed.data.plannedStartAt)!;
    const endParts = parsed.data.plannedEndAt
      ? parseIsoDateOnly(parsed.data.plannedEndAt)
      : startParts;
    if (!endParts) return jsonErr("VALIDATION_ERROR", "Data final inválida.", 400);
    const plannedStartAt = belemDayStartUtc(startParts.y, startParts.m, startParts.d);
    const plannedEndAt = belemDayStartUtc(endParts.y, endParts.m, endParts.d);
    if (plannedEndAt.getTime() < plannedStartAt.getTime()) {
      return jsonErr("VALIDATION_ERROR", "A data final não pode ser anterior à inicial.", 400);
    }

    const status = initialStatusOnCreate(parsed.data.markCompleted);
    const completedAt = status === "DONE" ? new Date() : null;

    const created = await prisma.$transaction(async (tx) => {
      const task = await tx.boardActivity.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          creatorId: user.id,
          assigneeId: parsed.data.assigneeId,
          unitId: unit.id,
          plannedStartAt,
          plannedEndAt,
          status,
          completedAt,
        },
        include: {
          assignee: { select: { id: true, name: true } },
          _count: { select: { comments: true, reactions: true } },
        },
      });
      await tx.boardActivityEvent.create({
        data: {
          taskId: task.id,
          actorId: user.id,
          type: "CREATED",
          payload: {
            status,
            assigneeId: task.assigneeId,
            createdAsCompleted: status === "DONE",
          },
        },
      });
      return task;
    });

    if (parsed.data.assigneeId !== user.id) {
      await createUserNotificationIfNew({
        userId: parsed.data.assigneeId,
        kind: "BOARD_ACTIVITY_ASSIGNED",
        title:
          status === "DONE"
            ? "Atividade concluída registrada para você"
            : "Nova atividade para você",
        body: created.title,
        linkUrl: `/gestao/atividades?task=${created.id}`,
        dedupeKey: `board-assign:${created.id}:${parsed.data.assigneeId}`,
      });
    }

    return jsonOk({ activity: mapCard(created) }, { status: 201 });
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
