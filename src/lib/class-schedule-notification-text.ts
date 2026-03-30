/**
 * Textos e URL das notificações de alteração de calendário (feriado, edição de turma).
 * Link da matrícula: página da turma (datas), não o conteúdo online.
 */

export function enrollmentSchedulePageUrl(enrollmentId: string): string {
  return `/minhas-turmas/${enrollmentId}`;
}

function turmaLabel(courseName: string | null | undefined): string {
  const t = courseName?.trim();
  return t && t.length > 0 ? t : "Turma";
}

export function titleScheduleChange(courseName: string | null | undefined): string {
  return `Calendário: ${turmaLabel(courseName)}`;
}

/** Recálculo por feriado/evento. */
export function bodyHolidayScheduleResync(courseName: string | null | undefined): string {
  const t = turmaLabel(courseName);
  return `A turma «${t}» teve o calendário de aulas atualizado (feriado ou evento). Confira as datas na página da turma.`;
}

/** Edição manual de turma (horário, dias, local, datas). */
export function bodyClassGroupScheduleChange(courseName: string | null | undefined): string {
  const t = turmaLabel(courseName);
  return `A turma «${t}»: horário, dias ou local foram alterados. Confira as datas das aulas na página da turma.`;
}
