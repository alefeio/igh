import { requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { notifyStudentsAfterHolidayScheduleResync } from "@/lib/holiday-schedule-notifications";

/**
 * Envia notificação de alteração de calendário só a alunos que ainda não receberam o aviso
 * de recálculo por feriado/evento (`holiday_resync` por matrícula).
 * Body: { "allTurmas": true } (obrigatório para evitar disparo acidental).
 */
export async function POST(request: Request) {
  try {
    await requireStaffWrite();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") {
      return jsonErr("UNAUTHENTICATED", "Sessão expirada ou não autenticado.", 401);
    }
    if (msg === "FORBIDDEN") {
      return jsonErr("FORBIDDEN", "Sem permissão.", 403);
    }
    throw e;
  }

  const body = await request.json().catch(() => null);
  const allTurmas =
    body &&
    typeof body === "object" &&
    "allTurmas" in body &&
    (body as { allTurmas?: unknown }).allTurmas === true;

  if (!allTurmas) {
    return jsonErr(
      "VALIDATION_ERROR",
      'Envie o corpo JSON {"allTurmas": true} para confirmar o envio do aviso a todos os alunos em turmas abertas.',
      400,
    );
  }

  const groups = await prisma.classGroup.findMany({
    where: { status: { not: "ENCERRADA" } },
    select: { id: true },
  });

  const ids = groups.map((g) => g.id);
  try {
    const { sent, skipped } = await notifyStudentsAfterHolidayScheduleResync(ids, {
      skipIfAlreadyNotified: true,
    });
    return jsonOk({ classGroupsNotified: ids.length, notificationsSent: sent, notificationsSkipped: skipped });
  } catch (e) {
    console.error("[notify-students-schedule]", e);
    return jsonErr(
      "NOTIFY_FAILED",
      e instanceof Error ? e.message : "Falha ao criar notificações.",
      500,
    );
  }
}
