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
