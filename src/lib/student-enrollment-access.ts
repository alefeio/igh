import "server-only";

/** Matrículas visíveis ao aluno (listagens, dashboard). */
export const STUDENT_VISIBLE_ENROLLMENT_STATUSES = ["ACTIVE", "SUSPENDED", "COMPLETED"] as const;

/** Matrículas com acesso ao conteúdo das aulas (exceto SUSPENDED). */
export const STUDENT_CONTENT_ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED"] as const;

export type StudentEnrollmentStatus = (typeof STUDENT_VISIBLE_ENROLLMENT_STATUSES)[number];

export function isEnrollmentContentBlocked(status: string): boolean {
  return status === "SUSPENDED" || status === "CANCELLED";
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
