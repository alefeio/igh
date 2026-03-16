import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Lista todos os chamados (apenas admin/master). */
export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }
  if (user.role !== "MASTER" && user.role !== "ADMIN") {
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }

  const tickets = await prisma.supportTicket.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      protocolNumber: true,
      subject: true,
      summary: true,
      status: true,
      attachmentUrls: true,
      attachmentNames: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { name: true, email: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, isFromSupport: true },
      },
    },
  });

  const withLastMessage = tickets.map((t) => {
    const { messages, ...rest } = t;
    const lastMsg = messages[0];

    // Status exibido para o admin/master: se estiver fechado, mantém CLOSED.
    // Caso contrário, usa a última mensagem para decidir entre OPEN/ANSWERED.
    const displayStatus =
      t.status === "CLOSED"
        ? "CLOSED"
        : lastMsg?.isFromSupport
        ? "ANSWERED"
        : "OPEN";

    return {
      ...rest,
      status: displayStatus,
      lastMessage: lastMsg
        ? { content: lastMsg.content, createdAt: lastMsg.createdAt }
        : null,
    };
  });

  return jsonOk({ tickets: withLastMessage });
}
