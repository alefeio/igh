/** Status que ocupam vaga na turma. Só cancelada libera vaga. */
export const ENROLLMENT_STATUSES_OCCUPYING_SEAT = ["ACTIVE", "SUSPENDED"] as const;

export type EnrollmentStatusOccupyingSeat =
  (typeof ENROLLMENT_STATUSES_OCCUPYING_SEAT)[number];

export function enrollmentOccupiesSeat(status: string | null | undefined): boolean {
  return status === "ACTIVE" || status === "SUSPENDED";
}
