import "server-only";

import { prisma } from "@/lib/prisma";

export type CertificateEligibility = {
  eligible: boolean;
  /** @deprecated mantido por compatibilidade da UI; espelha turma encerrada */
  progressComplete: boolean;
  /** Matrícula com status COMPLETED (informativo) */
  statusCompleted: boolean;
  classGroupEncerrada: boolean;
  totalLessons: number;
  completedLessons: number;
  reason: string | null;
};

/**
 * Por enquanto: certificado disponível quando a turma está ENCERRADA.
 */
export async function getCourseCertificateEligibility(enrollmentId: string): Promise<CertificateEligibility> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      status: true,
      classGroup: { select: { status: true, courseId: true } },
    },
  });

  if (!enrollment) {
    return {
      eligible: false,
      progressComplete: false,
      statusCompleted: false,
      classGroupEncerrada: false,
      totalLessons: 0,
      completedLessons: 0,
      reason: "Matrícula não encontrada.",
    };
  }

  const statusCompleted = enrollment.status === "COMPLETED";
  const classGroupEncerrada = enrollment.classGroup.status === "ENCERRADA";
  const eligible = classGroupEncerrada;

  return {
    eligible,
    progressComplete: classGroupEncerrada,
    statusCompleted,
    classGroupEncerrada,
    totalLessons: 0,
    completedLessons: 0,
    reason: eligible
      ? null
      : "O certificado ficará disponível quando a turma estiver encerrada.",
  };
}

export function resolveCertificateIssuedAt(params: {
  certificateIssuedAt: Date | null;
  status: string;
  updatedAt: Date;
  classGroupEndDate?: Date | null;
}): Date {
  if (params.certificateIssuedAt) return params.certificateIssuedAt;
  if (params.classGroupEndDate) return params.classGroupEndDate;
  if (params.status === "COMPLETED") return params.updatedAt;
  return new Date();
}
