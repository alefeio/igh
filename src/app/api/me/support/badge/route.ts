import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/**
 * Para aluno: retorna unreadCount (respostas do suporte não lidas em chamados não encerrados).
 * Para admin/master: retorna openCount (chamados não encerrados aguardando resposta do suporte).
 */
export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const isSupport =
    user.role === "MASTER" ||
    user.role === "ADMIN" ||
    user.role === "COORDINATOR" ||
    user.baseRole === "MASTER" ||
    user.baseRole === "ADMIN" ||
    user.isAdmin;

  if (isSupport) {
    // Chamados pendentes de resposta do admin: não encerrados e última mensagem é do aluno.
    // Importante: evitar query de relação com IN(NULL) quando não há tickets.
    const tickets = await prisma.supportTicket.findMany({
      where: { status: { not: "CLOSED" } },
      select: { id: true, status: true },
    });
    if (tickets.length === 0) {
      return jsonOk(
        { openCount: 0 },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    const ticketIds = tickets.map((t) => t.id);
    const lastMsgs = await prisma.supportTicketMessage.findMany({
      where: { ticketId: { in: ticketIds } },
      // Postgres: pega a última mensagem por ticket (createdAt desc).
      distinct: ["ticketId"],
      orderBy: [{ ticketId: "asc" }, { createdAt: "desc" }],
      select: { ticketId: true, isFromSupport: true },
    });
    const lastByTicketId = new Map(lastMsgs.map((m) => [m.ticketId, m.isFromSupport]));

    const openCount = tickets.reduce((acc, t) => {
      const lastIsFromSupport = lastByTicketId.get(t.id);
      // Sem mensagens ainda conta como pendente (aguardando suporte).
      if (lastIsFromSupport === undefined) return acc + 1;
      return lastIsFromSupport === false ? acc + 1 : acc;
    }, 0);
    return jsonOk(
      { openCount },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }

  /** Bolinha verde do suporte é só para perfil aluno; professores/outros não enxergam contagem de chamados de aluno. */
  if (user.role !== "STUDENT") {
    return jsonOk(
      { unreadCount: 0 },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id, status: { not: "CLOSED" } },
    select: {
      id: true,
      status: true,
      studentLastReadAt: true,
    },
  });
  if (tickets.length === 0) {
    return jsonOk(
      { unreadCount: 0 },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }

  const lastSupportMsgs = await prisma.supportTicketMessage.findMany({
    where: { ticketId: { in: tickets.map((t) => t.id) }, isFromSupport: true },
    distinct: ["ticketId"],
    orderBy: [{ ticketId: "asc" }, { createdAt: "desc" }],
    select: { ticketId: true, createdAt: true },
  });
  const lastSupportByTicketId = new Map(lastSupportMsgs.map((m) => [m.ticketId, m.createdAt]));

  const unreadCount = tickets.reduce((acc, t) => {
    if (t.status === "CLOSED") return acc;
    const lastSupport = lastSupportByTicketId.get(t.id);
    if (!lastSupport) return acc;
    const lastRead = t.studentLastReadAt ?? new Date(0);
    return lastSupport > lastRead ? acc + 1 : acc;
  }, 0);

  return jsonOk(
    { unreadCount },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
