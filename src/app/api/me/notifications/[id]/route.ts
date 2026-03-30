import { requireSessionUser } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/** Marca uma notificação como lida. */
export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireSessionUser();
  const { id } = await context.params;
  const result = await prisma.userNotification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    return jsonErr("NOT_FOUND", "Notificação não encontrada.", 404);
  }
  return jsonOk({ ok: true });
}
