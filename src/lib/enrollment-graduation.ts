/** Status em que o aluno ainda pode ser considerado formado, se a turma já encerrou. */
const GRADUATION_ELIGIBLE_STATUSES = new Set(["ACTIVE", "SUSPENDED", "COMPLETED"]);

/**
 * Aluno formado: certificado marcado e turma com status Encerrada.
 * Matrícula concluída ou certificado em turma ainda aberta não contam.
 * Sem o status da turma, o aluno não é formado.
 */
export function enrollmentCountsAsFormado(enrollment: {
  status: string;
  certificateEligible?: boolean | null;
  classGroupStatus?: string | null;
  classClosed?: boolean | null;
}): boolean {
  const classEncerrada =
    enrollment.classClosed === true || enrollment.classGroupStatus === "ENCERRADA";
  if (!classEncerrada) return false;
  if (enrollment.status === "CANCELLED") return false;
  if (!enrollment.certificateEligible) return false;
  return GRADUATION_ELIGIBLE_STATUSES.has(enrollment.status);
}
