import "server-only";

import type { Prisma, UserRole } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth";
import { requireRole } from "@/lib/auth";
import {
  BOARD_ELIGIBLE_ROLES,
  isBoardEligibleRole,
  isMasterOrAdminRole,
} from "@/lib/board-activities";
import {
  boardActivitiesAdminHint,
  getBoardActivitiesGateStatus,
} from "@/lib/board-activities-flag";
import { prisma } from "@/lib/prisma";

export { BOARD_ELIGIBLE_ROLES };
export async function requireBoardAccess(): Promise<SessionUser> {
  const gate = getBoardActivitiesGateStatus();
  if (!gate.active) {
    if (gate.reason !== "disabled") {
      console.warn("[board-activities]", boardActivitiesAdminHint(gate.reason));
    }
    throw new Error("BOARD_DISABLED");
  }
  return requireRole([...BOARD_ELIGIBLE_ROLES]);
}

export async function requireBoardCreatePermission(user: SessionUser): Promise<void> {
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { canCreateBoardTasks: true, isActive: true },
  });
  if (!row?.isActive || !row.canCreateBoardTasks) {
    throw new Error("FORBIDDEN_CREATE");
  }
}

export async function resolvePilotUnitOrThrow(): Promise<{ id: string; name: string }> {
  const gate = getBoardActivitiesGateStatus();
  if (!gate.active) {
    if (gate.reason !== "disabled") {
      console.warn("[board-activities]", boardActivitiesAdminHint(gate.reason));
    }
    throw new Error("BOARD_DISABLED");
  }
  const unit = await prisma.poloLocation.findFirst({
    where: { id: gate.unitId, isActive: true },
    select: { id: true, name: true },
  });
  if (!unit) {
    console.warn("[board-activities]", boardActivitiesAdminHint("unit_not_found"));
    throw new Error("UNIT_NOT_FOUND");
  }
  return unit;
}

/** Usuário interno ativo elegível ao quadro (papel-base ou overlay). */
export function userIsBoardEligible(u: {
  role: UserRole | string;
  isActive: boolean;
  isAdmin?: boolean;
  isSiteAdmin?: boolean;
  isPoloCoordinator?: boolean;
  isAdminManager?: boolean;
}): boolean {
  if (!u.isActive) return false;
  if (isBoardEligibleRole(u.role)) return true;
  // overlays: alguém com papel STUDENT + overlay admin não é o caso comum;
  // elegíveis por overlay quando role base é TEACHER etc. already covered.
  if (u.isAdmin || u.isSiteAdmin || u.isPoloCoordinator || u.isAdminManager) return true;
  return false;
}

export async function assertAssigneeEligible(assigneeId: string): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: assigneeId },
    select: {
      id: true,
      role: true,
      isActive: true,
      isAdmin: true,
      isSiteAdmin: true,
      isPoloCoordinator: true,
      isAdminManager: true,
    },
  });
  if (!u || !userIsBoardEligible(u)) {
    throw new Error("INVALID_ASSIGNEE");
  }
}

export async function listEligibleAssignees() {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: { in: [...BOARD_ELIGIBLE_ROLES] } },
        { isAdmin: true },
        { isSiteAdmin: true },
        { isPoloCoordinator: true },
        { isAdminManager: true },
      ],
    },
    select: { id: true, name: true, email: true, role: true, canCreateBoardTasks: true },
    orderBy: { name: "asc" },
    take: 500,
  });
  return users.filter((u) => u.role !== "STUDENT");
}

export function boardActivityListWhere(args: {
  unitId: string;
  fromUtc: Date;
  toExclusiveUtc: Date;
  mineUserId?: string | null;
  assigneeId?: string | null;
  q?: string | null;
  includeArchived?: boolean;
}): Prisma.BoardActivityWhereInput {
  const periodOr: Prisma.BoardActivityWhereInput[] = [
    {
      AND: [
        { plannedStartAt: { lt: args.toExclusiveUtc } },
        {
          OR: [
            { plannedEndAt: { gte: args.fromUtc } },
            {
              plannedEndAt: null,
              plannedStartAt: { gte: args.fromUtc, lt: args.toExclusiveUtc },
            },
          ],
        },
      ],
    },
    {
      AND: [
        { startedAt: { not: null, lt: args.toExclusiveUtc } },
        {
          OR: [
            { completedAt: { gte: args.fromUtc } },
            { completedAt: null, startedAt: { gte: args.fromUtc } },
            // em andamento desde antes do período: startedAt < from e completedAt null
            { completedAt: null, startedAt: { lt: args.fromUtc } },
          ],
        },
      ],
    },
  ];

  const where: Prisma.BoardActivityWhereInput = {
    unitId: args.unitId,
    archivedAt: args.includeArchived ? undefined : null,
    OR: periodOr,
  };

  if (args.mineUserId) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [{ creatorId: args.mineUserId }, { assigneeId: args.mineUserId }],
      },
    ];
  }
  if (args.assigneeId) {
    where.assigneeId = args.assigneeId;
  }
  if (args.q?.trim()) {
    where.title = { contains: args.q.trim(), mode: "insensitive" };
  }
  return where;
}

export function canAdminReassign(actor: SessionUser): boolean {
  return isMasterOrAdminRole(actor.role);
}
