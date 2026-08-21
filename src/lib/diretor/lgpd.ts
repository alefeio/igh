/** Constantes LGPD / agregação do perfil Diretor. */
export const MIN_AGGREGATE_GROUP_SIZE = 5;

/** Exibe contagem sensível: valores abaixo do limiar viram "<N". */
export function formatSensitiveCount(
  n: number,
  minSize: number = MIN_AGGREGATE_GROUP_SIZE,
): string {
  if (n > 0 && n < minSize) return `<${minSize}`;
  return String(n);
}

export function shouldSuppressSensitiveGroup(
  n: number,
  minSize: number = MIN_AGGREGATE_GROUP_SIZE,
): boolean {
  return n > 0 && n < minSize;
}
