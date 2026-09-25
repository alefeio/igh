/** Alunos da turma cujo certificado deve entrar no ZIP e na listagem de assinatura. */
export function classGroupCertificateEnrollmentWhere(classGroupId: string) {
  return {
    classGroupId,
    certificateEligible: true as const,
    status: { notIn: ["CANCELLED", "CANCELED"] },
  };
}
