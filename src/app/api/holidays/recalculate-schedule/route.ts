import { requireStaffWrite } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import { recalculateAllClassGroupSessionsAfterHolidayChange } from "@/lib/class-sessions-holiday-resync";

/**
 * Reexecuta o recálculo de sessões de todas as turmas não encerradas com a lista atual de feriados/eventos ativos.
 * Útil quando o primeiro cadastro gravou o feriado mas o recálculo falhou (ex.: timeout), sem precisar duplicar o registro.
 */
export async function POST() {
  try {
    await requireStaffWrite();
    const scheduleRecalculation = await recalculateAllClassGroupSessionsAfterHolidayChange();
    return jsonOk({ scheduleRecalculation });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") {
      return jsonErr("UNAUTHENTICATED", "Sessão expirada ou não autenticado.", 401);
    }
    if (msg === "FORBIDDEN") {
      return jsonErr("FORBIDDEN", "Sem permissão para recalcular o calendário.", 403);
    }
    console.error("[recalculate-schedule]", e);
    return jsonErr(
      "RECALC_SCHEDULE_ERROR",
      msg.length > 0 && msg.length < 400
        ? msg
        : "Erro ao recalcular o calendário. Tente novamente ou contate o suporte.",
      500,
    );
  }
}
