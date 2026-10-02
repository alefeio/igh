import type { DepartureReasonCode } from "@/lib/coordinator/types";

export const DEPARTURE_REASON_LABEL: Record<DepartureReasonCode, string> = {
  WORK_SCHEDULE: "Horário de trabalho",
  ADDRESS_CHANGE: "Mudança de endereço",
  TRANSPORTATION: "Transporte",
  HEALTH: "Saúde",
  LOSS_OF_INTEREST: "Perda de interesse",
  EXPECTATION_MISMATCH: "Expectativa diferente do curso",
  LEARNING_DIFFICULTY: "Dificuldade de aprendizagem",
  METHODOLOGY_OR_TEACHER: "Metodologia ou professor",
  LACK_OF_EQUIPMENT: "Falta de equipamento",
  EMPLOYMENT: "Emprego",
  TRANSFER: "Transferência de turma",
  UNREACHABLE: "Sem contato",
  ABANDONMENT_WITHOUT_REASON: "Abandono sem motivo informado",
  ADMINISTRATIVE: "Cancelamento administrativo",
  OTHER: "Outro",
};

export const RISK_LEVEL_LABEL = {
  CRITICAL: "Risco alto",
  WARNING: "Atenção",
  ATTENTION: "Acompanhar",
} as const;
