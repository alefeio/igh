import { authErrorResponse } from "@/lib/api-auth-guard";
import {
  notifyAdminManagers,
  requireEmployeePortal,
  serializeThreadDetail,
} from "@/lib/employee-portal";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { replyPortalThreadSchema } from "@/lib/validators/employee-portal";

type Ctx = { params: Promise<{ id: string }> };

const threadInclude = {
  employee: { select: { id: true, name: true, position: true, positionLabel: true } },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
};

export async function GET(_request: Request, ctx: Ctx) {
  let portal;
  try {
    portal = await requireEmployeePortal();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const thread = await prisma.employeePortalThread.findFirst({
    where: { id, employeeId: portal.employee.id },
    include: threadInclude,
  });
  if (!thread) return jsonErr("NOT_FOUND", "Conversa não encontrada.", 404);

  if (thread.unreadByEmployee) {
    await prisma.employeePortalThread.update({
      where: { id: thread.id },
      data: { unreadByEmployee: false },
    });
    thread.unreadByEmployee = false;
  }

  return jsonOk({ thread: serializeThreadDetail(thread) });
}

export async function POST(request: Request, ctx: Ctx) {
  let portal;
  try {
    portal = await requireEmployeePortal();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = replyPortalThreadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const existing = await prisma.employeePortalThread.findFirst({
    where: { id, employeeId: portal.employee.id },
    select: { id: true, status: true, subject: true },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Conversa não encontrada.", 404);
  if (existing.status === "ENCERRADA") {
    return jsonErr("THREAD_CLOSED", "Esta conversa foi encerrada.", 409);
  }

  await prisma.employeePortalMessage.create({
    data: {
      threadId: existing.id,
      authorUserId: portal.user.id,
      isFromManager: false,
      content: parsed.data.content,
    },
  });
  await prisma.employeePortalThread.update({
    where: { id: existing.id },
    data: { unreadByManager: true, unreadByEmployee: false, updatedAt: new Date() },
  });

  const thread = await prisma.employeePortalThread.findUniqueOrThrow({
    where: { id: existing.id },
    include: threadInclude,
  });

  await notifyAdminManagers({
    kind: "EMPLOYEE_PORTAL_MESSAGE",
    title: "Nova mensagem no portal",
    body: `${portal.employee.name}: ${existing.subject}`,
    linkUrl: `/admin/gerencia/portal?tab=mensagens&thread=${existing.id}`,
    dedupeKey: `employee-portal-msg:${thread.messages.at(-1)?.id ?? existing.id}`,
    exceptUserId: portal.user.id,
  });

  return jsonOk({ thread: serializeThreadDetail(thread) });
}
