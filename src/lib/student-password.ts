/**
 * Senha inicial do aluno no formato DDMMAAAA (8 dígitos).
 * Usa sempre o calendário da data armazenada em UTC (via ISO YYYY-MM-DD),
 * evitando desvio de fuso que ocorre com getDate()/getMonth() locais em
 * `new Date("AAAA-MM-DD")` — o que gerava senha diferente da informada no e-mail.
 */
export function birthDateToStudentPasswordParts(birthDate: Date): {
  password: string;
  formatted: string;
} {
  const iso = birthDate.toISOString().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match) {
    const [, y, month, day] = match;
    return {
      password: `${day}${month}${y}`,
      formatted: `${day}/${month}/${y}`,
    };
  }
  const d = birthDate.getUTCDate();
  const mo = birthDate.getUTCMonth() + 1;
  const y = birthDate.getUTCFullYear();
  const day = String(d).padStart(2, "0");
  const month = String(mo).padStart(2, "0");
  return {
    password: `${day}${month}${y}`,
    formatted: `${day}/${month}/${y}`,
  };
}

/** Comportamento antigo (local) — usado só para aceitar logins de contas criadas com getDate/getMonth locais. */
export function birthDateToStudentPasswordLegacyLocal(birthDate: Date): string {
  const day = String(birthDate.getDate()).padStart(2, "0");
  const month = String(birthDate.getMonth() + 1).padStart(2, "0");
  const year = birthDate.getFullYear();
  return `${day}${month}${year}`;
}

/**
 * Variantes digitáveis da senha por data de nascimento.
 * Inclui zeros à esquerda omitidos e data com barras/traços (só dígitos).
 */
export function studentPasswordCandidates(birthDate: Date): string[] {
  const { password: isoPwd } = birthDateToStudentPasswordParts(birthDate);
  const legPwd = birthDateToStudentPasswordLegacyLocal(birthDate);
  const out = new Set<string>();

  function addVariants(padded: string) {
    if (!/^\d{8}$/.test(padded)) return;
    const day = padded.slice(0, 2);
    const month = padded.slice(2, 4);
    const year = padded.slice(4, 8);
    out.add(padded);
    // Dia sem zero à esquerda (ex.: 01052010 → 1052010)
    if (day.startsWith("0")) out.add(`${day.slice(1)}${month}${year}`);
    // Mês sem zero à esquerda (ex.: 01052010 → 0152010)
    if (month.startsWith("0")) out.add(`${day}${month.slice(1)}${year}`);
    // Ambos sem zero (ex.: 01052010 → 152010)
    if (day.startsWith("0") && month.startsWith("0")) {
      out.add(`${day.slice(1)}${month.slice(1)}${year}`);
    }
  }

  addVariants(isoPwd);
  addVariants(legPwd);
  return Array.from(out);
}

/** Normaliza o que o aluno digitou: tira espaços/barras e mantém só dígitos quando parece data. */
export function normalizeTypedStudentPassword(password: string): string[] {
  const trimmed = password.trim();
  const digits = trimmed.replace(/\D/g, "");
  const out = new Set<string>([trimmed]);
  if (digits && digits !== trimmed) out.add(digits);
  return Array.from(out);
}
