export function contractHorizon(
  endDate: Date | null,
  asOf: Date,
): "expired" | "d30" | "d60" | "d90" | "later" | "open" {
  if (!endDate) return "open";
  const days = Math.ceil((endDate.getTime() - asOf.getTime()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "d30";
  if (days <= 60) return "d60";
  if (days <= 90) return "d90";
  return "later";
}

export function isBelowMinStock(quantityOnHand: number, minStock: number): boolean {
  return quantityOnHand > 0 && minStock > 0 && quantityOnHand <= minStock;
}

export function isZeroStock(quantityOnHand: number): boolean {
  return quantityOnHand <= 0;
}

/** Acima do mínimo (ou sem mínimo informado). Mutuamente exclusivo com zerado e abaixo/no mínimo. */
export function isAboveMinStock(quantityOnHand: number, minStock: number): boolean {
  if (isZeroStock(quantityOnHand) || isBelowMinStock(quantityOnHand, minStock)) return false;
  return true;
}

export function inventoryStockBand(
  quantityOnHand: number,
  minStock: number,
): "zero" | "at_or_below_min" | "above_min" {
  if (isZeroStock(quantityOnHand)) return "zero";
  if (isBelowMinStock(quantityOnHand, minStock)) return "at_or_below_min";
  return "above_min";
}

export function isStaleMovement(lastMovementAt: Date | null, asOf: Date, days = 90): boolean {
  if (!lastMovementAt) return true;
  return asOf.getTime() - lastMovementAt.getTime() > days * 86400000;
}

export function daysSince(from: Date, asOf: Date): number {
  return Math.max(0, Math.floor((asOf.getTime() - from.getTime()) / 86400000));
}
