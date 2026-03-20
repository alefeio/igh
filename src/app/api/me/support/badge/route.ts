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
    user.baseRole === "MASTER" ||
    user.baseRole === "ADMIN" ||
    user.isAdmin;

  if (isSupport) {
    // Chamados pendentes de resposta do admin: não encerrados e última mensagem é do aluno.
    const tickets = await prisma.supportTicket.findMany({
      where: { status: { not: "CLOSED" } },
      select: {
        id: true,
        status: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { isFromSupport: true },
        },
      },
    });
    const openCount = tickets.filter((t) => {
      if (t.status === "CLOSED") return false;
      const last = t.messages[0];
      return !last || last.isFromSupport === false;
    }).length;
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
      messages: {
        where: { isFromSupport: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const unreadCount = tickets.reduce((acc, t) => {
    if (t.status === "CLOSED") return acc;
    const lastSupport = t.messages[0]?.createdAt;
    if (!lastSupport) return acc;
    const lastRead = t.studentLastReadAt ?? new Date(0);
    return lastSupport > lastRead ? acc + 1 : acc;
  }, 0);

  return jsonOk(
    { unreadCount },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
