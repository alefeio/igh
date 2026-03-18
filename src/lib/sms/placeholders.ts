export interface PlaceholderData {
  nome?: string;
  primeiro_nome?: string;
  turma?: string;
  curso?: string;
  /** Lista de cursos (ex.: "Curso A, Curso B"). */
  cursos_matriculados?: string;
  /** Lista de turmas/linhas (uma por linha). */
  turmas_matriculadas?: string;
  /** Lista detalhada para HTML (ex.: <ul>...</ul>). */
  matriculas_html?: string;
  /** Alias de matriculas_html (lista HTML de cursos/matriculas). */
  cursos_html?: string;
  /** Lista detalhada para texto (uma por linha). */
  matriculas_texto?: string;
  unidade?: string;
  link?: string;
  /** Data de início da turma (dd/mm/aaaa) */
  data_inicio?: string;
  /** Horário da turma (ex.: 08:00 – 10:00) */
  horario?: string;
  /** Local da turma */
  local?: string;
  /** Link para área do aluno (igual a {link} se não informado) */
  link_area_aluno?: string;
  telefone_igh?: string;
  email_suporte?: string;
}

const PLACEHOLDERS = [
  "nome",
  "primeiro_nome",
  "turma",
  "curso",
  "cursos_matriculados",
  "turmas_matriculadas",
  "matriculas_html",
  "cursos_html",
  "matriculas_texto",
  "unidade",
  "link",
  "data_inicio",
  "horario",
  "local",
  "link_area_aluno",
  "telefone_igh",
  "email_suporte",
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
