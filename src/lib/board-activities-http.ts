import { authErrorResponse } from "@/lib/api-auth-guard";
import {
  boardActivitiesDisabledUserMessage,
  getBoardActivitiesGateStatus,
} from "@/lib/board-activities-flag";
import { jsonErr } from "@/lib/http";

/** Respostas padronizadas das APIs do Quadro (gate + auth). */
export function boardApiErrorResponse(e: unknown): Response | null {
  if (e instanceof Error && e.message === "BOARD_DISABLED") {
    const gate = getBoardActivitiesGateStatus();
    const reason = gate.active ? "disabled" : gate.reason;
    return jsonErr("FEATURE_DISABLED", boardActivitiesDisabledUserMessage(reason), 403);
  }
  if (e instanceof Error && e.message === "UNIT_NOT_FOUND") {
    return jsonErr(
      "FEATURE_DISABLED",
      boardActivitiesDisabledUserMessage("unit_not_found"),
      503,
    );
  }
  if (e instanceof Error && e.message === "UNIT_NOT_CONFIGURED") {
    return jsonErr(
      "FEATURE_DISABLED",
      boardActivitiesDisabledUserMessage("missing_unit"),
      503,
    );
  }
  if (e instanceof Error && e.message === "FORBIDDEN_CREATE") {
    return jsonErr("FORBIDDEN", "Você não tem permissão para criar atividades.", 403);
  }
  if (e instanceof Error && e.message === "INVALID_ASSIGNEE") {
    return jsonErr("VALIDATION_ERROR", "Responsável inválido ou inelegível.", 400);
  }
  if (e instanceof Error && e.message === "FORBIDDEN_VIEW") {
    return jsonErr("FORBIDDEN", "Somente o criador e os responsáveis podem abrir esta atividade.", 403);
  }
  return authErrorResponse(e);
}
