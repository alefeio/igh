import { boardApiErrorResponse } from "@/lib/board-activities-http";
import {
  canAdminReassign,
  requireBoardAccess,
  userIsBoardEligible,
} from "@/lib/board-activities-server";
import { prisma } from "@/lib/prisma";
import { jsonErr, jsonOk } from "@/lib/http";
import { boardCreatePermissionSchema } from "@/lib/validators/board-activities";

type Ctx = { params: Promise<{ userId: string }> };

/** Master/Admin altera a flag canCreateBoardTasks de um usuário elegível. */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requireBoardAccess();
    if (!canAdminReassign(actor)) {
      return jsonErr("FORBIDDEN", "Sem permissão.", 403);
    }
    const { userId } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = boardCreatePermissionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isActive: true,
        isAdmin: true,
        isSiteAdmin: true,
        isPoloCoordinator: true,
        isAdminManager: true,
        canCreateBoardTasks: true,
      },
    });
    if (!target || !userIsBoardEligible(target)) {
      return jsonErr("VALIDATION_ERROR", "Usuário inelegível para o Quadro de Atividades.", 400);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { canCreateBoardTasks: parsed.data.canCreateBoardTasks },
      select: { id: true, name: true, email: true, canCreateBoardTasks: true },
    });

    return jsonOk({ user: updated });
  } catch (e) {
    const auth = boardApiErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}
