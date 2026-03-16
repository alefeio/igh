import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { broadcastSupportBadgeUpdate } from "@/lib/support-ws-broadcast";

/** Retorna um chamado com mensagens (apenas se for dono ou admin/master). */
export async function GET(
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
    include: {
      user: { select: { name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          isFromSupport: true,
          createdAt: true,
        },
      },
    },
  });

  if (!ticket) {
    return jsonErr("NOT_FOUND", "Chamado não encontrado.", 404);
  }

  const isOwner = ticket.userId === user.id;
  const isSupport = user.role === "MASTER" || user.role === "ADMIN";

  if (!isOwner && !isSupport) {
    return jsonErr("FORBIDDEN", "Sem permissão para ver este chamado.", 403);
  }

  return jsonOk({
    ticket: {
      id: ticket.id,
      protocolNumber: ticket.protocolNumber,
      subject: ticket.subject,
      summary: ticket.summary,
      status: ticket.status,
      attachmentUrls: ticket.attachmentUrls ?? [],
      attachmentNames: ticket.attachmentNames ?? [],
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      user: ticket.user,
      messages: ticket.messages,
    },
  });
}

/** Atualiza o status do chamado (apenas encerrar). Dono ou admin/master. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!ticket) {
    return jsonErr("NOT_FOUND", "Chamado não encontrado.", 404);
  }

  const isOwner = ticket.userId === user.id;
  const isSupport =
    user.role === "MASTER" ||
    user.role === "ADMIN" ||
    user.baseRole === "MASTER" ||
    user.baseRole === "ADMIN" ||
    user.isAdmin;

  if (!isOwner && !isSupport) {
    return jsonErr("FORBIDDEN", "Sem permissão para alterar este chamado.", 403);
  }

  const body = await request.json().catch(() => null);
  const status = body?.status === "CLOSED" ? "CLOSED" : null;

  if (status !== "CLOSED") {
    return jsonErr(
      "VALIDATION_ERROR",
      "Apenas o status 'Encerrado' (CLOSED) pode ser definido.",
      400
    );
  }

  await prisma.supportTicket.update({
    where: { id },
    data: { status: "CLOSED", updatedAt: new Date() },
  });

  broadcastSupportBadgeUpdate();

  return jsonOk({ status: "CLOSED" });
}
