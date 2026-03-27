/** Sessão de aula para o calendário do painel admin (turmas abertas / em andamento). */
export type DashboardSessionCalendarItem = {
  sessionId: string;
  /** YYYY-MM-DD */
  sessionDate: string;
  startTime: string;
  endTime: string;
  classGroupId: string;
  courseName: string;
  teacherName: string;
  lessonTitle: string | null;
};
