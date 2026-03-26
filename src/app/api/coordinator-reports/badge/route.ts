import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Contagem de reportes não lidos (coordenador: novos do staff; professor/admin: resposta da coordenação). */
export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  if (user.role === "COORDINATOR") {
    const unreadCount = await prisma.coordinatorReport.count({
      where: { unreadByCoordinator: true, status: { not: "CLOSED" } },
    });
    return jsonOk({ unreadCount });
  }

  if (user.role === "TEACHER" || user.role === "ADMIN" || user.role === "MASTER") {
    const unreadCount = await prisma.coordinatorReport.count({
      where: {
        fromUserId: user.id,
        unreadByReporter: true,
        status: { not: "CLOSED" },
      },
    });
    return jsonOk({ unreadCount });
  }

  return jsonOk({ unreadCount: 0 });
}
