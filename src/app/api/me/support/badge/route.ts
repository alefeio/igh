import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/**
 * Para aluno: retorna unreadCount (quantidade de chamados com resposta do suporte não lida).
 * Para admin/master: retorna openCount (quantidade de chamados OPEN).
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
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { isFromSupport: true },
        },
      },
    });
    const openCount = tickets.filter((t) => {
      const last = t.messages[0];
      return !last || last.isFromSupport === false;
    }).length;
    return jsonOk({ openCount });
  }

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id },
    select: {
      id: true,
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
    const lastSupport = t.messages[0]?.createdAt;
    if (!lastSupport) return acc;
    const lastRead = t.studentLastReadAt ?? new Date(0);
    return lastSupport > lastRead ? acc + 1 : acc;
  }, 0);

  return jsonOk({ unreadCount });
}
