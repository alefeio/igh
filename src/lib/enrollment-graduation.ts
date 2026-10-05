/** Status em que o aluno ainda pode ser considerado formado (apto/concluído). */
const GRADUATION_ELIGIBLE_STATUSES = new Set(["ACTIVE", "SUSPENDED", "COMPLETED"]);

/**
 * Aluno formado no sentido pedagógico da IGH:
 * - apto a certificado (`certificateEligible`), ou
 * - matrícula marcada como concluída.
 */
export function enrollmentCountsAsFormado(enrollment: {
  status: string;
  certificateEligible?: boolean | null;
}): boolean {
  if (enrollment.status === "COMPLETED") return true;
  if (!enrollment.certificateEligible) return false;
  return GRADUATION_ELIGIBLE_STATUSES.has(enrollment.status);
}
