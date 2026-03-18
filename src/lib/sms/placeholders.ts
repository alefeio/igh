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
  /** Alias: mesma lista HTML que cursos_html (use {cursos} ou [cursos]). */
  cursos?: string;
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
  "cursos",
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Substitui uma chave nas formas: {chave}, [chave], &#123;chave&#125; (editores ricos que escapam chaves).
 */
function replacePlaceholderKey(out: string, key: string, value: string): string {
  const esc = escapeRegExp(key);
  const v = String(value);
  const patterns = [
    new RegExp(`\\{${esc}\\}`, "gi"),
    new RegExp(`\\[${esc}\\]`, "gi"),
    new RegExp(`&lbrace;${esc}&rbrace;`, "gi"),
    new RegExp(`&#123;${esc}&#125;`, "gi"),
    new RegExp(`&#x7b;${esc}&#x7d;`, "gi"),
    new RegExp(`&#x7B;${esc}&#x7D;`, "gi"),
  ];
  let s = out;
  for (const re of patterns) s = s.replace(re, v);
  return s;
}

/**
 * Substitui placeholders no texto da mensagem pelos valores do destinatário.
 * Suporta {nome}, [nome], e entidades HTML em chaves (TipTap/HTML).
 * Chaves mais longas primeiro para não colidir (ex.: curso vs cursos).
 */
export function renderSmsMessage(template: string, data: PlaceholderData): string {
  const cursosHtml = data.cursos_html ?? data.matriculas_html ?? "";
  const merged: Record<string, string> = {};
  for (const key of PLACEHOLDERS) {
    if (key === "cursos") {
      merged[key] = data.cursos ?? cursosHtml;
    } else {
      merged[key] = String(data[key as keyof PlaceholderData] ?? "");
    }
  }
  const keys = Object.keys(merged).sort((a, b) => b.length - a.length);
  let out = template;
  for (const key of keys) {
    out = replacePlaceholderKey(out, key, merged[key] ?? "");
  }
  return out;
}

/**
 * Extrai primeiro nome (primeira palavra do nome).
 */
export function firstName(fullName: string): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}
