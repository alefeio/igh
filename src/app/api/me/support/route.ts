import "server-only";

import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { getAppUrl } from "@/lib/email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateSupportTicketCreated } from "@/lib/email/templates";
import { jsonErr, jsonOk } from "@/lib/http";

/** Lista chamados do usuário logado. Para aluno, inclui hasUnread por ticket. */
export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      protocolNumber: true,
      subject: true,
      summary: true,
      status: true,
      attachmentUrls: true,
      attachmentNames: true,
      studentLastReadAt: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, isFromSupport: true },
      },
    },
  });

  const isSupport =
    user.role === "MASTER" ||
    user.role === "ADMIN" ||
    user.baseRole === "MASTER" ||
    user.baseRole === "ADMIN" ||
    user.isAdmin;

  const mapped = tickets.map((t) => {
    const lastMsg = t.messages[0];
    const lastRead = t.studentLastReadAt ?? new Date(0);
    const hasUnread =
      t.status !== "CLOSED" &&
      lastMsg?.isFromSupport === true &&
      lastMsg.createdAt > lastRead;

    // Status exibido depende de quem está vendo:
    // - Se estiver fechado, sempre CLOSED.
    // - Caso contrário:
    //   - Para suporte (admin/master): última do suporte => RESPONDIDO, última do aluno => ABERTO.
    //   - Para aluno (dono): última do suporte => ABERTO, última do aluno => RESPONDIDO.
    let displayStatus: "OPEN" | "ANSWERED" | "CLOSED" = "OPEN";
    if (t.status === "CLOSED") {
      displayStatus = "CLOSED";
    } else if (lastMsg) {
      if (isSupport) {
        displayStatus = lastMsg.isFromSupport ? "ANSWERED" : "OPEN";
      } else {
        displayStatus = lastMsg.isFromSupport ? "OPEN" : "ANSWERED";
      }
    } else {
      displayStatus = t.status === "ANSWERED" ? "ANSWERED" : "OPEN";
    }

    const { messages: _, ...rest } = t;
    return {
      ...rest,
      status: displayStatus,
      hasUnread,
      lastMessage: lastMsg
        ? { content: lastMsg.content, createdAt: lastMsg.createdAt }
        : null,
    };
  });

  return jsonOk({ tickets: mapped });
}

/** Gera próximo número de protocolo (ano-número sequencial). */
async function getNextProtocolNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const last = await prisma.supportTicket.findFirst({
    where: { protocolNumber: { startsWith: prefix } },
    orderBy: { protocolNumber: "desc" },
    select: { protocolNumber: true },
  });
  const nextNum = last
    ? parseInt(last.protocolNumber.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}

/** Cria novo chamado de suporte (apenas aluno). */
export async function POST(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }
  if (user.role !== "STUDENT") {
    return jsonErr("FORBIDDEN", "Apenas alunos podem abrir chamados de suporte.", 403);
  }

  const body = await request.json().catch(() => null);
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  const rawUrls = Array.isArray(body?.attachmentUrls) ? body.attachmentUrls.filter((u: unknown) => typeof u === "string") as string[] : [];
  const rawNames = Array.isArray(body?.attachmentNames) ? body.attachmentNames.filter((n: unknown) => typeof n === "string") as string[] : [];
  const attachmentUrls = rawUrls.slice(0, 20);
  const attachmentNames = rawNames.slice(0, attachmentUrls.length);
  while (attachmentNames.length < attachmentUrls.length) attachmentNames.push("");

  if (subject.length < 3) {
    return jsonErr("VALIDATION_ERROR", "Assunto deve ter pelo menos 3 caracteres.", 400);
  }
  if (summary.length < 10) {
    return jsonErr("VALIDATION_ERROR", "Descreva seu problema com pelo menos 10 caracteres.", 400);
  }

  const protocolNumber = await getNextProtocolNumber();

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      protocolNumber,
      subject,
      summary,
      status: "OPEN",
      attachmentUrls,
      attachmentNames,
    },
    select: {
      id: true,
      protocolNumber: true,
      subject: true,
      summary: true,
      status: true,
      attachmentUrls: true,
      attachmentNames: true,
      createdAt: true,
    },
  });

  const ticketUrl = getAppUrl(`/suporte/${ticket.id}`);
  const { subject: emailSubject, html } = templateSupportTicketCreated({
    name: user.name,
    protocolNumber: ticket.protocolNumber,
    subject: ticket.subject,
    summary: ticket.summary,
    ticketUrl,
    attachmentCount: attachmentUrls.length,
  });

  await sendEmailAndRecord({
    to: user.email,
    subject: emailSubject,
    html,
    emailType: "support_ticket_created",
    entityType: "SupportTicket",
    entityId: ticket.id,
  }).catch(() => {});

  return jsonOk({ ticket });
}
