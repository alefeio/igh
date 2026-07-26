/**
 * Conflito de horário semanal entre turmas. Sem dependências de servidor, então pode ser
 * usado tanto nas telas quanto nas rotas de API — a regra precisa valer nos dois lados.
 */

export type WeeklySchedule = {
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
};

/** Converte "HH:MM" ou "HH:MM:SS" em minutos desde meia-noite. */
export function timeToMinutes(t: string): number {
  const parts = (t || "0:0").split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/** Duas turmas conflitam quando compartilham um dia da semana e os horários se cruzam. */
export function weeklyScheduleOverlaps(a: WeeklySchedule, b: WeeklySchedule): boolean {
  const daysA = new Set(Array.isArray(a.daysOfWeek) ? a.daysOfWeek : []);
  const daysB = new Set(Array.isArray(b.daysOfWeek) ? b.daysOfWeek : []);
  const sharesDay = [...daysA].some((d) => daysB.has(d));
  if (!sharesDay) return false;
  const startA = timeToMinutes(a.startTime);
  const endA = timeToMinutes(a.endTime);
  const startB = timeToMinutes(b.startTime);
  const endB = timeToMinutes(b.endTime);
  return startA < endB && endA > startB;
}
