import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { broadcastSupportBadgeUpdate } from "@/lib/support-ws-broadcast";

/** Marca o chamado como lido pelo aluno (atualiza studentLastReadAt). */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const { id } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!ticket || ticket.userId !== user.id) {
    return jsonErr("NOT_FOUND", "Chamado não encontrado.", 404);
  }

  await prisma.supportTicket.update({
    where: { id },
    data: { studentLastReadAt: new Date() },
  });

  broadcastSupportBadgeUpdate("student", user.id);

  return jsonOk({ ok: true });
}
