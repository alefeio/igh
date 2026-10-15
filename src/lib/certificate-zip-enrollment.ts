/** Cancelados não entram no ZIP. Qualquer outro status entra se o certificado estiver habilitado. */
const CERTIFICATE_ZIP_EXCLUDED_STATUSES = ["CANCELLED", "CANCELED"] as const;

export function certificateZipStatusWhere() {
  return { notIn: [...CERTIFICATE_ZIP_EXCLUDED_STATUSES] };
}

/** Alunos da turma cujo certificado deve entrar no ZIP e na listagem de assinatura. */
export function classGroupCertificateEnrollmentWhere(classGroupId: string) {
  return {
    classGroupId,
    certificateEligible: true as const,
    status: certificateZipStatusWhere(),
  };
}

/** Mesma regra, para várias turmas selecionadas na listagem. */
export function classGroupsCertificateEnrollmentWhere(classGroupIds: string[]) {
  return {
    classGroupId: { in: classGroupIds },
    certificateEligible: true as const,
    status: certificateZipStatusWhere(),
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
