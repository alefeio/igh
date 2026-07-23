import "server-only";

/** Matrículas visíveis ao aluno (listagens, dashboard). */
export const STUDENT_VISIBLE_ENROLLMENT_STATUSES = ["ACTIVE", "SUSPENDED", "COMPLETED"] as const;

/** Matrículas com acesso ao conteúdo das aulas (exceto SUSPENDED). */
export const STUDENT_CONTENT_ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED"] as const;

/** Status de turma em que a matrícula não deve contar como “ativa” no painel do aluno. */
export const STUDENT_INACTIVE_CLASS_GROUP_STATUSES = ["ENCERRADA", "CANCELADA"] as const;

export type StudentEnrollmentStatus = (typeof STUDENT_VISIBLE_ENROLLMENT_STATUSES)[number];

export function isEnrollmentContentBlocked(status: string): boolean {
  return status === "SUSPENDED" || status === "CANCELLED";
}

/** Matrícula ACTIVE em turma ainda em curso (não encerrada/cancelada). */
export function isStudentEnrollmentActiveInClassGroup(params: {
  enrollmentStatus: string;
  classGroupStatus: string;
}): boolean {
  if (params.enrollmentStatus !== "ACTIVE") return false;
  return !(STUDENT_INACTIVE_CLASS_GROUP_STATUSES as readonly string[]).includes(
    params.classGroupStatus
  );
}

/** Turma encerrada ou com período já terminado — aluno mantém acesso ao conteúdo integral. */
export function isClassGroupEndedForStudentAccess(cg: {
  status: string;
  endDate: Date | null;
  startDate?: Date;
}): boolean {
  if (cg.status === "ENCERRADA") return true;
  if (cg.endDate) {
    const end = cg.endDate;
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    return end.getTime() < todayUtc.getTime();
  }
  return false;
}
