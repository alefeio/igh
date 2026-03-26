import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { getAppUrl } from "@/lib/email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import { templateCoordinatorReportReplyToReporter } from "@/lib/email/templates";
import { jsonErr, jsonOk } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  const { id: reportId } = await params;

  const report = await prisma.coordinatorReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      protocolNumber: true,
      subject: true,
      status: true,
      fromUserId: true,
      fromUser: { select: { name: true, email: true } },
    },
  });

  if (!report) {
    return jsonErr("NOT_FOUND", "Reporte não encontrado.", 404);
  }

  if (report.status === "CLOSED") {
    return jsonErr("VALIDATION_ERROR", "Este reporte está encerrado.", 400);
  }

  const isCoordinator = user.role === "COORDINATOR";
  const isReporter = report.fromUserId === user.id;

  if (!isCoordinator && !isReporter) {
    return jsonErr("FORBIDDEN", "Sem permissão para responder neste reporte.", 403);
  }

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const rawUrls = Array.isArray(body?.attachmentUrls) ? body.attachmentUrls.filter((u: unknown) => typeof u === "string") as string[] : [];
  const rawNames = Array.isArray(body?.attachmentNames) ? body.attachmentNames.filter((n: unknown) => typeof n === "string") as string[] : [];
  const attachmentUrls = rawUrls.slice(0, 20);
  const attachmentNames = rawNames.slice(0, attachmentUrls.length);
  while (attachmentNames.length < attachmentUrls.length) attachmentNames.push("");

  if (content.length < 1) {
    return jsonErr("VALIDATION_ERROR", "Digite uma mensagem.", 400);
  }

  const isFromCoordinator = isCoordinator;

  const message = await prisma.coordinatorReportMessage.create({
    data: {
      reportId: report.id,
      authorUserId: user.id,
      isFromCoordinator,
      content,
      attachmentUrls,
      attachmentNames,
    },
    select: {
      id: true,
      content: true,
      isFromCoordinator: true,
      attachmentUrls: true,
      attachmentNames: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });

  await prisma.coordinatorReport.update({
    where: { id: report.id },
    data: {
      status: isFromCoordinator ? "ANSWERED" : report.status,
      unreadByCoordinator: !isFromCoordinator,
      unreadByReporter: isFromCoordinator,
      updatedAt: new Date(),
    },
  });

  if (isFromCoordinator && report.fromUser.email) {
    const threadUrl = getAppUrl(`/coordenacao/${report.id}`);
    const preview = content.length > 200 ? `${content.slice(0, 200)}…` : content;
    const { subject, html } = templateCoordinatorReportReplyToReporter({
      reporterName: report.fromUser.name,
      protocolNumber: report.protocolNumber,
      subject: report.subject,
      messagePreview: preview,
      threadUrl,
    });
    await sendEmailAndRecord({
      to: report.fromUser.email,
      subject,
      html,
      emailType: "coordinator_report_reply",
      entityType: "CoordinatorReport",
      entityId: report.id,
      performedByUserId: user.id,
    }).catch(() => {});
  }

  return jsonOk({ message });
}
