/**
 * Feature gate do Quadro de Atividades.
 * Seguro por padrão: desativado salvo BOARD_ACTIVITIES_ENABLED=true.
 * Sem hardcode de unidade — ID via BOARD_ACTIVITIES_POLO_LOCATION_ID.
 *
 * Seguro para import em Client Components (só lê process.env embutido no build
 * quando o nome é conhecido; no servidor lê o runtime).
 */

export type BoardActivitiesGateInactiveReason =
  | "disabled"
  | "missing_unit"
  | "invalid_unit_format";

export type BoardActivitiesGateStatus =
  | { active: true; unitId: string }
  | { active: false; reason: BoardActivitiesGateInactiveReason };

function readEnabledFlag(): boolean {
  return process.env.BOARD_ACTIVITIES_ENABLED === "true";
}

function readConfiguredUnitId(): string | null {
  const id = process.env.BOARD_ACTIVITIES_POLO_LOCATION_ID?.trim();
  return id && id.length > 0 ? id : null;
}

/** UUID v4 simples — evita ID vazio/lixo sem validar existência no banco. */
function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Leitura síncrona do gate (sem DB).
 * Menu e APIs usam a mesma função para não divergir.
 */
export function getBoardActivitiesGateStatus(): BoardActivitiesGateStatus {
  if (!readEnabledFlag()) {
    return { active: false, reason: "disabled" };
  }
  const unitId = readConfiguredUnitId();
  if (!unitId) {
    return { active: false, reason: "missing_unit" };
  }
  if (!looksLikeUuid(unitId)) {
    return { active: false, reason: "invalid_unit_format" };
  }
  return { active: true, unitId };
}

/** Visível no menu somente quando o gate está ativo (flag + unit ID formatado). */
export function isBoardActivitiesNavVisible(): boolean {
  return getBoardActivitiesGateStatus().active;
}

export function boardActivitiesDisabledUserMessage(
  reason: BoardActivitiesGateInactiveReason | "unit_not_found",
): string {
  if (reason === "disabled") {
    return "O Quadro de Atividades não está disponível neste ambiente.";
  }
  // Mensagem genérica para usuários comuns; detalhes ficam no log do servidor.
  return "O Quadro de Atividades está temporariamente indisponível. Contate a administração.";
}

export function boardActivitiesAdminHint(
  reason: BoardActivitiesGateInactiveReason | "unit_not_found",
): string {
  switch (reason) {
    case "disabled":
      return "Defina BOARD_ACTIVITIES_ENABLED=true neste ambiente para ativar o piloto.";
    case "missing_unit":
      return "BOARD_ACTIVITIES_ENABLED=true, mas BOARD_ACTIVITIES_POLO_LOCATION_ID não está definido.";
    case "invalid_unit_format":
      return "BOARD_ACTIVITIES_POLO_LOCATION_ID não é um UUID válido.";
    case "unit_not_found":
      return "BOARD_ACTIVITIES_POLO_LOCATION_ID não corresponde a um PoloLocation ativo.";
    default:
      return "Configuração do Quadro de Atividades inválida.";
  }
}
