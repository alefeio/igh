import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Marca como lido para o perfil atual (coordenador ou quem reportou). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const { id } = await params;

  const report = await prisma.coordinatorReport.findUnique({
    where: { id },
    select: { id: true, fromUserId: true },
  });

  if (!report) {
    return jsonErr("NOT_FOUND", "Reporte não encontrado.", 404);
  }

  if (user.role === "COORDINATOR") {
    await prisma.coordinatorReport.update({
      where: { id },
      data: { unreadByCoordinator: false, updatedAt: new Date() },
    });
    return jsonOk({ ok: true });
  }

  if (report.fromUserId === user.id) {
    await prisma.coordinatorReport.update({
      where: { id },
      data: { unreadByReporter: false, updatedAt: new Date() },
    });
    return jsonOk({ ok: true });
  }

  return jsonErr("FORBIDDEN", "Sem permissão.", 403);
}
