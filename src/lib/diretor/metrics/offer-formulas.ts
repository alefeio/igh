/** Funções puras de oferta — fonte única para APIs e testes (Fase 1A). */

export function occupancyPercent(occupied: number, capacity: number): number | null {
  if (capacity <= 0) return null;
  return Math.round((occupied / capacity) * 1000) / 10;
}

export function isLowOccupancyClass(occupied: number, capacity: number): boolean {
  if (capacity <= 0) return occupied === 0;
  const p = occupancyPercent(occupied, capacity);
  return p != null && (occupied === 0 || p < 30);
}

export function seatOfferAcceptRate(params: {
  accepted: number;
  expired: number;
  cancelled: number;
}): number | null {
  const den = params.accepted + params.expired + params.cancelled;
  if (den <= 0) return null;
  return Math.round((params.accepted / den) * 1000) / 10;
}

/**
 * Demanda candidata única: união de studentIds da lista de espera (e ids extras opcionais).
 * Inscrições já registradas ocupam vaga e não entram como demanda.
 */
export function uniqueDemandStudentIds(params: {
  extraStudentIds?: string[];
  waitlistWaitingStudentIds: string[];
}): { uniqueCount: number; ids: string[] } {
  const set = new Set<string>([...(params.extraStudentIds ?? []), ...params.waitlistWaitingStudentIds]);
  return { uniqueCount: set.size, ids: [...set] };
}

export type DemandCompletionQuadrant =
  | "expand"
  | "review_execution"
  | "review_marketing"
  | "reassess"
  | "unavailable";

export function demandCompletionQuadrant(params: {
  hasClosedCohort: boolean;
  demandProxy: number;
  capacity: number;
  waitlist: number;
  completionStartedRate: number | null;
}): DemandCompletionQuadrant {
  if (!params.hasClosedCohort || params.completionStartedRate == null) return "unavailable";
  const highDemand =
    params.demandProxy >= (params.capacity || 1) * 0.8 || params.waitlist > 0;
  const highCompletion = params.completionStartedRate >= 70;
  if (highDemand && highCompletion) return "expand";
  if (highDemand && !highCompletion) return "review_execution";
  if (!highDemand && highCompletion) return "review_marketing";
  return "reassess";
}
