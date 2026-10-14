/** Cancelados não entram no ZIP. Pré-matrícula entra se o certificado estiver habilitado. */
const CERTIFICATE_ZIP_EXCLUDED_STATUSES = ["CANCELLED", "CANCELED"] as const;

/** Alunos da turma cujo certificado deve entrar no ZIP e na listagem de assinatura. */
export function classGroupCertificateEnrollmentWhere(classGroupId: string) {
  return {
    classGroupId,
    certificateEligible: true as const,
    status: { notIn: [...CERTIFICATE_ZIP_EXCLUDED_STATUSES] },
  };
}

/** Mesma regra da turma, aplicada a todas as turmas não canceladas do ciclo. */
export function cycleCertificateEnrollmentWhere(cycleId: string) {
  return {
    certificateEligible: true as const,
    status: { notIn: [...CERTIFICATE_ZIP_EXCLUDED_STATUSES] },
    classGroup: { cycleId, status: { not: "CANCELADA" as const } },
  };
}
