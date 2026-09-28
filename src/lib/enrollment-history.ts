export const ENROLLMENT_HISTORY_KINDS = [
  "JUSTIFICATIVA",
  "CANCELAMENTO",
  "QUARTA_FALTA",
  "BUSCA_ATIVA",
] as const;

export type EnrollmentHistoryKindValue = (typeof ENROLLMENT_HISTORY_KINDS)[number];

export const ENROLLMENT_HISTORY_KIND_LABEL: Record<EnrollmentHistoryKindValue, string> = {
  JUSTIFICATIVA: "Justificativa",
  CANCELAMENTO: "Cancelamento",
  QUARTA_FALTA: "4ª falta sem cancelamento",
  BUSCA_ATIVA: "Busca ativa",
};

export const ENROLLMENT_HISTORY_BODY_MAX = 2000;

export function trimHistoryBody(value: string): string {
  return value.trim().slice(0, ENROLLMENT_HISTORY_BODY_MAX);
}
