import "server-only";

import { syncCertificateEligibleFromAttendance } from "@/lib/enrollment-certificate-eligibility-sync";
import { prisma } from "@/lib/prisma";

export type CertificateEligibility = {
  eligible: boolean;
  /** @deprecated mantido por compatibilidade da UI; espelha turma encerrada */
  progressComplete: boolean;
  /** Matrícula com status COMPLETED (informativo) */
  statusCompleted: boolean;
  classGroupEncerrada: boolean;
  /** Flag da matrícula: apto a receber certificado (≥70% presença ou liberado pelo professor). */
  certificateEligible: boolean;
  totalLessons: number;
  completedLessons: number;
  reason: string | null;
};

/**
 * Certificado disponível quando a turma está ENCERRADA e a matrícula está apta
 * (`certificateEligible` — auto com ≥70% de presença ou toggle do professor).
 */
export async function getCourseCertificateEligibility(enrollmentId: string): Promise<CertificateEligibility> {
  // Atualiza a flag automática (≥70%) antes de avaliar, sem sobrescrever override do professor.
  await syncCertificateEligibleFromAttendance([enrollmentId]);

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      status: true,
      certificateEligible: true,
      classGroup: { select: { status: true, courseId: true } },
    },
  });

  if (!enrollment) {
    return {
      eligible: false,
      progressComplete: false,
      statusCompleted: false,
      classGroupEncerrada: false,
      certificateEligible: false,
      totalLessons: 0,
      completedLessons: 0,
      reason: "Matrícula não encontrada.",
    };
  }

  const statusCompleted = enrollment.status === "COMPLETED";
  const classGroupEncerrada = enrollment.classGroup.status === "ENCERRADA";
  const certificateEligible = enrollment.certificateEligible === true;
  const eligible = classGroupEncerrada && certificateEligible;

  let reason: string | null = null;
  if (!eligible) {
    if (!classGroupEncerrada && !certificateEligible) {
      reason =
        "O certificado ficará disponível quando a turma estiver encerrada e a matrícula estiver apta (70% de presença ou liberação do professor).";
    } else if (!classGroupEncerrada) {
      reason = "O certificado ficará disponível quando a turma estiver encerrada.";
    } else {
      reason =
        "Esta matrícula não está apta a receber certificado. É necessário 70% de presença ou liberação pelo professor.";
    }
  }

  return {
    eligible,
    progressComplete: classGroupEncerrada,
    statusCompleted,
    classGroupEncerrada,
    certificateEligible,
    totalLessons: 0,
    completedLessons: 0,
    reason,
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
