/** Normaliza CPF para 11 dígitos ou string vazia se inválido. */
export function normalizeCpfDigits(input: string): string {
  const d = input.replace(/\D/g, "");
  return d.length === 11 ? d : "";
}

/** Nome para comparação (trim, espaços, minúsculas, sem acentos). */
export function normalizePersonName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Compara data de nascimento do banco (@db.Date) com string YYYY-MM-DD. */
export function birthDateMatchesDatabase(db: Date, yyyyMmDd: string): boolean {
  const t = yyyyMmDd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const [y, m, d] = t.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  return db.getUTCFullYear() === y && db.getUTCMonth() + 1 === m && db.getUTCDate() === d;
}
