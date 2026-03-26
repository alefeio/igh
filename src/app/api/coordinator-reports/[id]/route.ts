import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

function canAccessReport(
  user: { id: string; role: string },
  report: { fromUserId: string },
): boolean {
  if (user.role === "COORDINATOR") return true;
  return report.fromUserId === user.id;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const { id } = await params;

  const report = await prisma.coordinatorReport.findUnique({
    where: { id },
    include: {
      fromUser: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!report) {
    return jsonErr("NOT_FOUND", "Reporte não encontrado.", 404);
  }

  if (!canAccessReport(user, report)) {
    return jsonErr("FORBIDDEN", "Sem permissão para ver este reporte.", 403);
  }

  return jsonOk({
    report: {
      id: report.id,
      protocolNumber: report.protocolNumber,
      subject: report.subject,
      summary: report.summary,
      status: report.status,
      attachmentUrls: report.attachmentUrls ?? [],
      attachmentNames: report.attachmentNames ?? [],
      unreadByCoordinator: report.unreadByCoordinator,
      unreadByReporter: report.unreadByReporter,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      fromUser: report.fromUser,
      messages: report.messages.map((m) => ({
        id: m.id,
        content: m.content,
        isFromCoordinator: m.isFromCoordinator,
        attachmentUrls: m.attachmentUrls ?? [],
        attachmentNames: m.attachmentNames ?? [],
        createdAt: m.createdAt,
        author: m.author,
      })),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  if (!canAccessReport(user, report)) {
    return jsonErr("FORBIDDEN", "Sem permissão.", 403);
  }

  const body = await request.json().catch(() => null);
  if (body?.status !== "CLOSED") {
    return jsonErr("VALIDATION_ERROR", "Apenas o encerramento (status CLOSED) é permitido.", 400);
  }

  await prisma.coordinatorReport.update({
    where: { id },
    data: { status: "CLOSED", updatedAt: new Date() },
  });

  return jsonOk({ status: "CLOSED" });
}
