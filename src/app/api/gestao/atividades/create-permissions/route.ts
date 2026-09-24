import { boardApiErrorResponse } from "@/lib/board-activities-http";
import {
  BOARD_ELIGIBLE_ROLES,
  canAdminReassign,
  requireBoardAccess,
  userIsBoardEligible,
} from "@/lib/board-activities-server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";

/** Lista usuários elegíveis ao quadro para gestão de canCreateBoardTasks (Master/Admin). */
export async function GET(request: Request) {
  try {
    const actor = await requireBoardAccess();
    if (!canAdminReassign(actor)) {
      return jsonErr("FORBIDDEN", "Sem permissão.", 403);
    }

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";

    const eligibilityOr: Prisma.UserWhereInput[] = [
      { role: { in: [...BOARD_ELIGIBLE_ROLES] } },
      { isAdmin: true },
      { isSiteAdmin: true },
      { isPoloCoordinator: true },
      { isAdminManager: true },
    ];

    const where: Prisma.UserWhereInput = {
      AND: [
        { OR: eligibilityOr },
        ...(q
          ? [
              {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { email: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    };

    const rows = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        canCreateBoardTasks: true,
        isAdmin: true,
        isSiteAdmin: true,
        isPoloCoordinator: true,
        isAdminManager: true,
      },
      orderBy: { name: "asc" },
      take: 500,
    });

    const users = rows
      .filter((u) => u.role !== "STUDENT")
      .filter((u) => userIsBoardEligible({ ...u, isActive: true }))
      .map(({ id, name, email, role, isActive, canCreateBoardTasks }) => ({
        id,
        name,
        email,
        role,
        isActive,
        canCreateBoardTasks,
      }));

    return jsonOk({ users });
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
