import "server-only";

import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { getAppUrl } from "@/lib/email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateSupportTicketUpdate } from "@/lib/email/templates";
import { jsonErr, jsonOk } from "@/lib/http";
import { broadcastSupportBadgeUpdate } from "@/lib/support-ws-broadcast";

/** Adiciona mensagem ao chamado. Aluno ou suporte (admin/master). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const { id: ticketId } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      userId: true,
      protocolNumber: true,
      subject: true,
      status: true,
      user: { select: { name: true, email: true } },
    },
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
    return jsonErr("FORBIDDEN", "Sem permissão para responder neste chamado.", 403);
  }

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (content.length < 1) {
    return jsonErr("VALIDATION_ERROR", "Digite uma mensagem.", 400);
  }

  const isFromSupport = isSupport && !isOwner;

  const message = await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      authorUserId: user.id,
      isFromSupport,
      content,
    },
    select: {
      id: true,
      content: true,
      isFromSupport: true,
      createdAt: true,
    },
  });

  // Atualiza apenas o status real quando a resposta vem do suporte.
  // Quando o aluno responde, mantemos o status atual e apenas atualizamos o updatedAt;
  // o status exibido na interface passa a ser derivado da última mensagem.
  if (isFromSupport && ticket.status !== "CLOSED") {
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "ANSWERED", updatedAt: new Date() },
    });
  } else {
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date() },
    });
  }

  const ticketUrl = getAppUrl(`/suporte/${ticket.id}`);
  const messagePreview = content.length > 200 ? content.slice(0, 200) + "…" : content;
  const emailContent = templateSupportTicketUpdate({
    name: ticket.user.name,
    protocolNumber: ticket.protocolNumber,
    subject: ticket.subject,
    messagePreview,
    ticketUrl,
    isFromSupport: Boolean(isFromSupport),
  });

  await sendEmailAndRecord({
    to: ticket.user.email,
    subject: emailContent.subject,
    html: emailContent.html,
    emailType: "support_ticket_update",
    entityType: "SupportTicket",
    entityId: ticket.id,
  }).catch(() => {});

  // Notificação em tempo real: admin respondeu → atualiza badge do aluno; aluno respondeu → atualiza badge do admin.
  broadcastSupportBadgeUpdate(
    isFromSupport ? "student" : "admin",
    isFromSupport ? ticket.userId : undefined
  );

  return jsonOk({ message });
}
