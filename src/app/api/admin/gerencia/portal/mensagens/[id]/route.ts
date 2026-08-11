import { authErrorResponse } from "@/lib/api-auth-guard";
import { requireAdminManager } from "@/lib/auth";
import { serializeThreadDetail } from "@/lib/employee-portal";
import { createUserNotificationIfNew } from "@/lib/user-notifications";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { replyPortalThreadSchema } from "@/lib/validators/employee-portal";

type Ctx = { params: Promise<{ id: string }> };

const threadInclude = {
  employee: { select: { id: true, name: true, position: true, positionLabel: true, userId: true } },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true } } },
  },
};

export async function GET(_request: Request, ctx: Ctx) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const thread = await prisma.employeePortalThread.findUnique({
    where: { id },
    include: threadInclude,
  });
  if (!thread) return jsonErr("NOT_FOUND", "Conversa não encontrada.", 404);

  if (thread.unreadByManager) {
    await prisma.employeePortalThread.update({
      where: { id: thread.id },
      data: { unreadByManager: false },
    });
    thread.unreadByManager = false;
  }

  return jsonOk({ thread: serializeThreadDetail(thread) });
}

export async function POST(request: Request, ctx: Ctx) {
  let actor;
  try {
    actor = await requireAdminManager();
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

  const existing = await prisma.employeePortalThread.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      subject: true,
      employee: { select: { userId: true, name: true } },
    },
  });
  if (!existing) return jsonErr("NOT_FOUND", "Conversa não encontrada.", 404);

  await prisma.employeePortalMessage.create({
    data: {
      threadId: existing.id,
      authorUserId: actor.id,
      isFromManager: true,
      content: parsed.data.content,
    },
  });
  await prisma.employeePortalThread.update({
    where: { id: existing.id },
    data: {
      status: "ABERTA",
      unreadByManager: false,
      unreadByEmployee: true,
      updatedAt: new Date(),
    },
  });

  const thread = await prisma.employeePortalThread.findUniqueOrThrow({
    where: { id: existing.id },
    include: threadInclude,
  });

  if (existing.employee.userId) {
    await createUserNotificationIfNew({
      userId: existing.employee.userId,
      kind: "EMPLOYEE_PORTAL_MESSAGE",
      title: "Resposta da gerência",
      body: existing.subject,
      linkUrl: `/colaborador/mensagens/${existing.id}`,
      dedupeKey: `employee-portal-msg:${thread.messages.at(-1)?.id ?? existing.id}`,
    });
  }

  return jsonOk({ thread: serializeThreadDetail(thread) });
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    await requireAdminManager();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (body?.status !== "ABERTA" && body?.status !== "ENCERRADA") {
    return jsonErr("VALIDATION_ERROR", "Status inválido.", 400);
  }

  const existing = await prisma.employeePortalThread.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return jsonErr("NOT_FOUND", "Conversa não encontrada.", 404);

  const thread = await prisma.employeePortalThread.update({
    where: { id },
    data: { status: body.status },
    include: threadInclude,
  });

  return jsonOk({ thread: serializeThreadDetail(thread) });
}
