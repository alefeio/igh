const BRAZIL_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Dia da aula. `sessionDate` (@db.Date) chega como meia-noite UTC desse calendário. */
export function sessionCalendarKey(sessionDate: Date): string {
  return sessionDate.toISOString().slice(0, 10);
}

/** Dia civil em Brasília (UTC−3). */
export function brazilCalendarKey(instant: Date): string {
  const brazil = new Date(instant.getTime() - BRAZIL_UTC_OFFSET_MS);
  return brazil.toISOString().slice(0, 10);
}

/**
 * A aula entra na frequência do aluno a partir do dia da matrícula.
 * Aula de um dia anterior não é falta e não entra no denominador.
 */
export function sessionCountsForEnrollment(sessionDate: Date, enrolledAt: Date): boolean {
  return sessionCalendarKey(sessionDate) >= brazilCalendarKey(enrolledAt);
}
