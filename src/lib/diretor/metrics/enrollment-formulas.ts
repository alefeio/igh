/** Regras executivas 1C.1 — matrícula, ocupação atual e progressão de faltas. */

export const CURRENT_CLASS_GROUP_STATUSES = ["ABERTA", "EM_ANDAMENTO"] as const;

export const ABSENCE_NEAR_SUSPENSION_STREAK = 2;
export const ABSENCE_SUSPENSION_STREAK = 3;
export const ABSENCE_CANCEL_STREAK = 4;

export type AbsenceExecutiveBand =
  | "none"
  | "near_suspension"
  | "identified_three"
  | "unprocessed_cancellation"
  | "cancellation_inferred";

/** Classifica só a evidência de sequência. Não atribui causa ao status. */
export function classifyAbsenceExecutive(params: {
  status: string;
  streak: number;
}): AbsenceExecutiveBand {
  if (params.status !== "CANCELLED" && params.streak >= ABSENCE_CANCEL_STREAK) {
    return "unprocessed_cancellation";
  }
  if (params.status === "CANCELLED" && params.streak >= ABSENCE_CANCEL_STREAK) {
    return "cancellation_inferred";
  }
  if (params.status !== "CANCELLED" && params.streak === ABSENCE_SUSPENSION_STREAK) {
    return "identified_three";
  }
  if (params.status === "ACTIVE" && params.streak === ABSENCE_NEAR_SUSPENSION_STREAK) {
    return "near_suspension";
  }
  return "none";
}

export type AbsenceProgressionCounts = {
  suspendedNow: number;
  streakTwo: number;
  streakThree: number;
  cancelledKnownReason: number;
  cancelledUnknownReason: number;
  unprocessedFour: number;
  cancelledInferredAfterFour: number;
};

/**
 * Contagens exclusivas por natureza do indicador.
 * Suspenso (status) não soma com streak 3 num único total.
 * Cancelado não entra em inconsistência de quatro faltas.
 */
export function countAbsenceProgression(
  rows: Array<{ status: string; streak: number }>,
): AbsenceProgressionCounts {
  const out: AbsenceProgressionCounts = {
    suspendedNow: 0,
    streakTwo: 0,
    streakThree: 0,
    cancelledKnownReason: 0,
    cancelledUnknownReason: 0,
    unprocessedFour: 0,
    cancelledInferredAfterFour: 0,
  };
  for (const r of rows) {
    if (r.status === "SUSPENDED") out.suspendedNow += 1;
    if (r.status === "CANCELLED") {
      out.cancelledUnknownReason += 1;
    }
    const band = classifyAbsenceExecutive(r);
    if (band === "near_suspension") out.streakTwo += 1;
    if (band === "identified_three") out.streakThree += 1;
    if (band === "unprocessed_cancellation") out.unprocessedFour += 1;
    if (band === "cancellation_inferred") out.cancelledInferredAfterFour += 1;
  }
  return out;
}

/** Não há instante de cancelamento no Enrollment (sem canceledAt / histórico). */
export const CANCELLATION_PERIOD_UNAVAILABLE_REASON =
  "Não há data de cancelamento nem histórico de status. updatedAt não é usado como data do evento.";

export const INFERRED_ABSENCE_CANCELLATION_COPY =
  "Cancelamento identificado após sequência de faltas — causa ainda não registrada de forma estruturada.";

export function isCycleEnrollment(): boolean {
  return true;
}

export function isCurrentClassGroup(status: string): boolean {
  return (CURRENT_CLASS_GROUP_STATUSES as readonly string[]).includes(status);
}

/**
 * Ocupa vaga agora: ativa ou suspensa em turma vigente.
 * Cancelada e concluída ficam fora. Turma encerrada, planejada ou cancelada não entra no estoque atual.
 */
export function occupiesCurrentSeat(params: { enrollmentStatus: string; classGroupStatus: string }): boolean {
  if (!isCurrentClassGroup(params.classGroupStatus)) return false;
  return params.enrollmentStatus === "ACTIVE" || params.enrollmentStatus === "SUSPENDED";
}

export function reconcileNonStart(enrollments: number, started: number): {
  notStarted: number;
  rate: number | null;
} {
  if (enrollments < 0 || started < 0) return { notStarted: 0, rate: null };
  const notStarted = Math.max(0, enrollments - started);
  if (enrollments <= 0) return { notStarted, rate: null };
  return { notStarted, rate: Math.round((notStarted / enrollments) * 1000) / 10 };
}

/** Zero de presença não é resultado executivo quando a chamada está incompleta. */
export function executivePresenceCount(
  count: number,
  reliable: boolean,
): {
  value: number | null;
  quality: "ok" | "partial" | "unavailable";
  unavailableReason: string | null;
} {
  if (!reliable && count === 0) {
    return {
      value: null,
      quality: "unavailable",
      unavailableReason: "Chamadas incompletas. Não interpretar a ausência de número como zero de alunos.",
    };
  }
  if (!reliable) {
    return { value: count, quality: "partial", unavailableReason: null };
  }
  return { value: count, quality: "ok", unavailableReason: null };
}

export function directorEnrollmentEntry(e: { id: string; classGroupId: string; enrolledAt: Date }) {
  return { id: e.id, classGroupId: e.classGroupId, enteredAt: e.enrolledAt };
}
