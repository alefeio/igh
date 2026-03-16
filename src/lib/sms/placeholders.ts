export interface PlaceholderData {
  nome?: string;
  primeiro_nome?: string;
  turma?: string;
  curso?: string;
  unidade?: string;
  link?: string;
}

const PLACEHOLDERS = [
  "nome",
  "primeiro_nome",
  "turma",
  "curso",
  "unidade",
  "link",
] as const;

/**
 * Substitui placeholders no texto da mensagem pelos valores do destinatário.
 * Valores ausentes são substituídos por string vazia (unidade não existe no schema atual = "" ou "N/A").
 */
export function renderSmsMessage(template: string, data: PlaceholderData): string {
  let out = template;
  for (const key of PLACEHOLDERS) {
    const value = data[key] ?? "";
    const regex = new RegExp(`\\{${key}\\}`, "gi");
    out = out.replace(regex, String(value));
  }
  return out;
}

/**
 * Extrai primeiro nome (primeira palavra do nome).
 */
export function firstName(fullName: string): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}
