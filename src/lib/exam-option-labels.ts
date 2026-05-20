/** Rótulo da alternativa na prova: A), B), C), D)… */
export function examOptionLabel(index: number): string {
  if (index >= 0 && index < 26) {
    return `${String.fromCharCode(65 + index)})`;
  }
  return `${index + 1})`;
}
