import "server-only";

/** Fim do dia de hoje no fuso do Brasil (UTC−3), para liberar sessões pelo calendário local. */
export function getEndOfTodayBrazil(): Date {
  const BRAZIL_UTC_OFFSET_HOURS = 3; // BRT = UTC−3 → subtrair 3h de UTC para obter a "data" em Brasil
  const now = new Date();
  const brazilMoment = new Date(now.getTime() - BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const y = brazilMoment.getUTCFullYear();
  const m = brazilMoment.getUTCMonth();
  const d = brazilMoment.getUTCDate();
  return new Date(Date.UTC(y, m, d, 23 + BRAZIL_UTC_OFFSET_HOURS, 59, 59, 999));
}
