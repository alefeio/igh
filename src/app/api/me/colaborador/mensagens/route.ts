import { authErrorResponse } from "@/lib/api-auth-guard";
import {
  notifyAdminManagers,
  requireEmployeePortal,
  serializeThreadListItem,
  threadListSelect,
} from "@/lib/employee-portal";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createPortalThreadSchema } from "@/lib/validators/employee-portal";

export async function GET() {
  try {
    const { employee } = await requireEmployeePortal();
    const rows = await prisma.employeePortalThread.findMany({
      where: { employeeId: employee.id },
      orderBy: { updatedAt: "desc" },
      select: threadListSelect,
      take: 100,
    });
    return jsonOk({ threads: rows.map((row) => serializeThreadListItem(row, "employee")) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireEmployeePortal();
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return auth;
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createPortalThreadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const thread = await prisma.employeePortalThread.create({
    data: {
      employeeId: ctx.employee.id,
      subject: parsed.data.subject,
      unreadByManager: true,
      unreadByEmployee: false,
      messages: {
        create: {
          authorUserId: ctx.user.id,
          isFromManager: false,
          content: parsed.data.content,
        },
      },
    },
    select: { id: true },
  });

  await notifyAdminManagers({
    kind: "EMPLOYEE_PORTAL_MESSAGE",
    title: "Mensagem no portal do colaborador",
    body: `${ctx.employee.name}: ${parsed.data.subject}`,
    linkUrl: `/admin/gerencia/portal?tab=mensagens&thread=${thread.id}`,
    dedupeKey: `employee-portal-thread:${thread.id}`,
    exceptUserId: ctx.user.id,
  });

  return jsonOk({ id: thread.id }, { status: 201 });
}
