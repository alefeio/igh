import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookie } from "@/lib/auth";
import { getAppUrl } from "@/lib/email";
import { sendEmailAndRecord } from "@/lib/email/send-and-record";
import {
  templateCoordinatorReportNewToCoordinator,
} from "@/lib/email/templates";
import { jsonErr, jsonOk } from "@/lib/http";
import { getNextCoordinatorReportProtocol } from "@/lib/coordinator-report-protocol";

function canCreateReport(role: string): boolean {
  return role === "TEACHER" || role === "ADMIN" || role === "MASTER";
}

function isCoordinatorRole(role: string): boolean {
  return role === "COORDINATOR";
}

/** Lista reportes: coordenador vê todos; professor/admin/master vê só os seus. */
export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }

  if (isCoordinatorRole(user.role)) {
    const reports = await prisma.coordinatorReport.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        protocolNumber: true,
        subject: true,
        summary: true,
        status: true,
        unreadByCoordinator: true,
        createdAt: true,
        updatedAt: true,
        fromUser: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, createdAt: true, isFromCoordinator: true },
        },
      },
    });
    return jsonOk({
      reports: reports.map(({ messages, ...r }) => ({
        ...r,
        lastMessagePreview: messages[0]?.content ?? null,
        lastMessageAt: messages[0]?.createdAt ?? null,
      })),
      view: "coordinator" as const,
    });
  }

  if (!canCreateReport(user.role)) {
    return jsonErr("FORBIDDEN", "Sem permissão para listar reportes.", 403);
  }

  const reports = await prisma.coordinatorReport.findMany({
    where: { fromUserId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      protocolNumber: true,
      subject: true,
      summary: true,
      status: true,
      unreadByReporter: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, isFromCoordinator: true },
      },
    },
  });

  return jsonOk({
    reports: reports.map(({ messages, ...r }) => ({
      ...r,
      lastMessagePreview: messages[0]?.content ?? null,
      lastMessageAt: messages[0]?.createdAt ?? null,
    })),
    view: "reporter" as const,
  });
}

/** Cria reporte (professor, admin ou master). */
export async function POST(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Não autorizado.", 401);
  }
  if (!canCreateReport(user.role)) {
    return jsonErr("FORBIDDEN", "Apenas professores e administradores podem enviar reportes à coordenação.", 403);
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
    return jsonErr("VALIDATION_ERROR", "Descreva o reporte com pelo menos 10 caracteres.", 400);
  }

  const coordinators = await prisma.user.findMany({
    where: { role: "COORDINATOR", isActive: true },
    select: { id: true, name: true, email: true },
  });

  if (coordinators.length === 0) {
    return jsonErr(
      "NO_COORDINATOR",
      "Não há coordenador cadastrado no sistema. Peça ao Master para criar um usuário Coordenador antes de enviar reportes.",
      400,
    );
  }

  const protocolNumber = await getNextCoordinatorReportProtocol();

  const report = await prisma.coordinatorReport.create({
    data: {
      fromUserId: user.id,
      protocolNumber,
      subject,
      summary,
      status: "OPEN",
      attachmentUrls,
      attachmentNames,
      unreadByCoordinator: true,
      unreadByReporter: false,
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

  const reportUrl = getAppUrl(`/coordenacao/${report.id}`);
  const summaryPreview = summary.length > 400 ? `${summary.slice(0, 400)}…` : summary;

  await Promise.all(
    coordinators.map((c) => {
      const { subject: subj, html } = templateCoordinatorReportNewToCoordinator({
        coordinatorName: c.name,
        protocolNumber: report.protocolNumber,
        subject: report.subject,
        summaryPreview,
        fromName: user.name,
        reportUrl,
      });
      return sendEmailAndRecord({
        to: c.email,
        subject: subj,
        html,
        emailType: "coordinator_report_new",
        entityType: "CoordinatorReport",
        entityId: report.id,
        performedByUserId: user.id,
      }).catch(() => {});
    }),
  );

  return jsonOk({ report }, { status: 201 });
}
