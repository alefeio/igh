/** Marcador lido pelo restore para aceitar o arquivo. */
export const BACKUP_SQL_MARKER = "-- Backup gerado por Prisma (fallback, sem pg_dump)";

/** Cada resposta HTTP fica abaixo do limite de ~4,5 MB da Vercel, já com o JSON em volta. */
export const BACKUP_CHUNK_MAX_CHARS = 1_200_000;

/** Um INSERT precisa caber num lote do restore (~800 mil caracteres). */
export const BACKUP_STATEMENT_MAX_CHARS = 700_000;

const INSERT_BATCH = 50;

export type SqlColumnKind = "json" | "bytea" | "array" | "scalar";

export type SqlColumn = {
  name: string;
  kind: SqlColumnKind;
};

export type BackupTableCount = {
  name: string;
  rowCount: number;
};

export class BackupInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupInputError";
  }
}

export function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new BackupInputError("Nome de tabela ou coluna inválido.");
  }
  return `"${name}"`;
}

function sqlJson(val: unknown): string {
  const json = JSON.stringify(val);
  if (json === undefined) return "NULL";
  return `'${json.replace(/\\/g, "\\\\").replace(/'/g, "''")}'::jsonb`;
}

function bytesToHex(val: Uint8Array): string {
  let hex = "";
  for (const byte of val) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

function sqlBytea(val: unknown): string {
  if (val instanceof Uint8Array) return `'\\x${bytesToHex(val)}'`;
  if (typeof val === "string") return `'\\x${val.replace(/[^0-9a-f]/gi, "")}'`;
  return sqlJson(val);
}

function sqlArray(val: unknown[]): string {
  if (val.length === 0) return "'{}'";
  const items = val.map((item) => {
    if (item === null || item === undefined) return "NULL";
    if (typeof item === "object") {
      return JSON.stringify(item).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }
    const s = String(item).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${s}"`;
  });
  return `'{${items.join(",")}}'`;
}

/** Escapa um valor para literal SQL de INSERT. */
export function sqlLiteral(val: unknown, kind: SqlColumnKind = "scalar"): string {
  if (val === null || val === undefined) return "NULL";
  if (kind === "json") return sqlJson(val);
  if (kind === "bytea") return sqlBytea(val);
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "bigint") return String(val);
  if (typeof val === "number" && !Number.isNaN(val)) return String(val);
  if (val instanceof Date) return `'${val.toISOString().replace(/'/g, "''")}'`;
  if (kind === "array" && Array.isArray(val)) return sqlArray(val);
  if (Array.isArray(val)) return sqlArray(val);
  if (typeof val === "object") return sqlJson(val);
  const s = String(val);
  return `'${s.replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
}

export function insertStatement(table: string, columns: SqlColumn[], rows: Record<string, unknown>[]): string {
  const quotedCols = columns.map((column) => quoteIdent(column.name)).join(", ");
  const values = rows
    .map((row) => `(${columns.map((column) => sqlLiteral(row[column.name], column.kind)).join(", ")})`)
    .join(",\n");
  return `INSERT INTO ${quoteIdent(table)} (${quotedCols}) VALUES\n${values};`;
}

/**
 * Monta INSERTs até `maxChars`. A primeira linha entra mesmo que sozinha passe do limite,
 * para o cursor conseguir avançar.
 */
export function takeRowsForChunk(
  table: string,
  columns: SqlColumn[],
  rows: Record<string, unknown>[],
  maxChars: number,
): { sql: string; consumed: number } {
  const statements: string[] = [];
  let used = 0;
  let index = 0;

  while (index < rows.length) {
    let batchEnd = index;
    let statement = "";
    while (batchEnd < rows.length && batchEnd - index < INSERT_BATCH) {
      const next = insertStatement(table, columns, rows.slice(index, batchEnd + 1));
      const wouldOverflow =
        batchEnd > index &&
        (next.length > BACKUP_STATEMENT_MAX_CHARS || used + next.length + 1 > maxChars);
      const firstDoesNotFit =
        batchEnd === index && used + next.length > maxChars && (statements.length > 0 || used > 0);
      if (wouldOverflow || firstDoesNotFit) break;
      statement = next;
      batchEnd += 1;
      if (statement.length >= BACKUP_STATEMENT_MAX_CHARS) break;
    }
    if (!statement || batchEnd === index) break;
    statements.push(statement);
    used += statement.length + 1;
    index = batchEnd;
    if (used >= maxChars) break;
  }

  return { sql: statements.join("\n"), consumed: index };
}

export function renderBackupPreamble(input: { generatedAt: string; tables: BackupTableCount[] }): string {
  const totalRows = input.tables.reduce((sum, table) => sum + table.rowCount, 0);
  const lines = [
    BACKUP_SQL_MARKER,
    `-- Data: ${input.generatedAt}`,
    `-- Tabelas: ${input.tables.length}`,
    `-- Registros: ${totalRows}`,
    "-- Cada tabela listada entra por completo neste arquivo.",
    ...input.tables.map((table) => `-- ${quoteIdent(table.name)}: ${table.rowCount}`),
    "",
    "TRUNCATE TABLE " + input.tables.map((table) => quoteIdent(table.name)).join(", ") + " CASCADE;",
    "",
  ];
  return lines.join("\n");
}

export function exportedRowsLookComplete(exported: number, expected: number): boolean {
  if (expected <= 0) return exported === 0;
  if (exported <= 0) return false;
  if (exported >= expected) return true;
  const missing = expected - exported;
  if (expected < 100) return missing <= 2;
  return missing / expected <= 0.01;
}

export function encodeBackupCursor(values: string[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(values));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeBackupCursor(raw: string): string[] {
  if (!raw || raw.length > 4000) throw new BackupInputError("Cursor de backup inválido.");
  try {
    const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
    const binary = atob(raw.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 4) {
      throw new BackupInputError("Cursor de backup inválido.");
    }
    if (parsed.some((value) => typeof value !== "string" || value.length > 200)) {
      throw new BackupInputError("Cursor de backup inválido.");
    }
    return parsed as string[];
  } catch (error) {
    if (error instanceof BackupInputError) throw error;
    throw new BackupInputError("Cursor de backup inválido.");
  }
}
