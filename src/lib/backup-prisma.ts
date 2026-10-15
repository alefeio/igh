import { prisma } from "@/lib/prisma";
import {
  BACKUP_CHUNK_MAX_CHARS,
  BackupInputError,
  type BackupTableCount,
  type SqlColumn,
  type SqlColumnKind,
  quoteIdent,
  takeRowsForChunk,
} from "@/lib/backup-sql";

const PAGE_SIZE = 400;
const MAX_PAGES_PER_REQUEST = 25;

type PkColumn = { name: string; cast: string };

type TableShape = {
  columns: SqlColumn[];
  pk: PkColumn[];
};

const shapeCache = new Map<string, TableShape>();

const PK_CASTS: Record<string, string> = {
  uuid: "::uuid",
  text: "::text",
  varchar: "::text",
  bpchar: "::text",
  name: "::text",
  int2: "::smallint",
  int4: "::int",
  int8: "::bigint",
  bool: "::boolean",
  timestamptz: "::timestamptz",
  timestamp: "::timestamp",
  date: "::date",
};

function columnKind(dataType: string, udtName: string): SqlColumnKind {
  if (dataType === "json" || dataType === "jsonb" || udtName === "json" || udtName === "jsonb") return "json";
  if (dataType === "bytea" || udtName === "bytea") return "bytea";
  if (dataType === "ARRAY" || udtName.startsWith("_")) return "array";
  return "scalar";
}

function asCount(value: unknown): number {
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Contagem de registros inválida.");
  return n;
}

/**
 * Tabelas do schema public na ordem das FKs (referenciadas antes de quem referencia).
 */
async function getTableNamesInOrder(): Promise<string[]> {
  const list = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  const allTables = new Set(list.map((row) => row.tablename));

  type Edge = { child: string; parent: string };
  const edges = await prisma.$queryRaw<Edge[]>`
    SELECT c.relname AS child, p.relname AS parent
    FROM pg_constraint fk
    JOIN pg_class c ON c.oid = fk.conrelid
    JOIN pg_class p ON p.oid = fk.confrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE fk.contype = 'f' AND p.relname IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
  `;

  const outDegree: Record<string, number> = {};
  const childrenOf: Record<string, string[]> = {};
  for (const table of allTables) {
    outDegree[table] = 0;
    childrenOf[table] = [];
  }
  for (const { child, parent } of edges) {
    if (!allTables.has(child) || !allTables.has(parent) || child === parent) continue;
    outDegree[child] = (outDegree[child] ?? 0) + 1;
    if (!childrenOf[parent]) childrenOf[parent] = [];
    childrenOf[parent].push(child);
  }

  const order: string[] = [];
  const queue = [...allTables].filter((table) => outDegree[table] === 0);
  while (queue.length) {
    const table = queue.shift()!;
    order.push(table);
    for (const child of childrenOf[table] ?? []) {
      outDegree[child]--;
      if (outDegree[child] === 0) queue.push(child);
    }
  }
  const remaining = [...allTables].filter((table) => !order.includes(table));
  return [...order, ...remaining];
}

async function loadShapes(tableNames: string[]): Promise<Map<string, TableShape>> {
  const missing = tableNames.filter((name) => !shapeCache.has(name));
  if (missing.length === 0) {
    return new Map(tableNames.map((name) => [name, shapeCache.get(name)!]));
  }

  const columns = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string; data_type: string; udt_name: string }[]>(
    `SELECT table_name, column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`,
  );
  const pks = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string; type_name: string; ord: number }[]>(
    `SELECT c.relname AS table_name,
            a.attname AS column_name,
            t.typname AS type_name,
            k.ord AS ord
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     JOIN pg_index i ON i.indrelid = c.oid AND i.indisprimary
     JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
     JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum AND NOT a.attisdropped
     JOIN pg_type t ON t.oid = a.atttypid
     WHERE c.relkind = 'r'
     ORDER BY c.relname, k.ord`,
  );

  const columnsByTable = new Map<string, SqlColumn[]>();
  for (const column of columns) {
    const list = columnsByTable.get(column.table_name) ?? [];
    list.push({ name: column.column_name, kind: columnKind(column.data_type, column.udt_name) });
    columnsByTable.set(column.table_name, list);
  }
  const pkByTable = new Map<string, PkColumn[]>();
  for (const pk of pks) {
    const cast = PK_CASTS[pk.type_name];
    if (!cast) {
      throw new BackupInputError(`A chave de ${pk.table_name}.${pk.column_name} não pode ser paginada (${pk.type_name}).`);
    }
    const list = pkByTable.get(pk.table_name) ?? [];
    list.push({ name: pk.column_name, cast });
    pkByTable.set(pk.table_name, list);
  }

  for (const name of missing) {
    const shapeColumns = columnsByTable.get(name) ?? [];
    const pk = pkByTable.get(name) ?? [];
    if (shapeColumns.length === 0) throw new BackupInputError(`Tabela ${name} não encontrada.`);
    if (pk.length === 0) {
      throw new BackupInputError(`A tabela ${name} não tem chave primária e não entra no backup.`);
    }
    shapeCache.set(name, { columns: shapeColumns, pk });
  }

  return new Map(tableNames.map((name) => [name, shapeCache.get(name)!]));
}

export async function getBackupManifest(): Promise<{
  generatedAt: string;
  tables: BackupTableCount[];
  totalRows: number;
}> {
  const names = await getTableNamesInOrder();
  if (names.length === 0) {
    return { generatedAt: new Date().toISOString(), tables: [], totalRows: 0 };
  }
  await loadShapes(names);
  const countSql = names
    .map((name) => `SELECT '${name.replace(/'/g, "''")}' AS name, COUNT(*)::bigint AS n FROM ${quoteIdent(name)}`)
    .join(" UNION ALL ");
  const counts = await prisma.$queryRawUnsafe<{ name: string; n: unknown }[]>(countSql);
  const byName = new Map(counts.map((row) => [row.name, asCount(row.n)]));
  const tables = names.map((name) => {
    const rowCount = byName.get(name);
    if (rowCount === undefined) throw new Error(`Sem contagem da tabela ${name}.`);
    return { name, rowCount };
  });
  return {
    generatedAt: new Date().toISOString(),
    tables,
    totalRows: tables.reduce((sum, table) => sum + table.rowCount, 0),
  };
}

function cursorFromRow(row: Record<string, unknown>, pk: PkColumn[]): string[] {
  return pk.map((column) => {
    const value = row[column.name];
    if (value === null || value === undefined) {
      throw new Error(`Chave primária nula em ${column.name}.`);
    }
    if (value instanceof Date) return value.toISOString();
    return String(value);
  });
}

async function fetchPage(table: string, pk: PkColumn[], cursor: string[] | null): Promise<Record<string, unknown>[]> {
  const order = pk.map((column) => quoteIdent(column.name)).join(", ");
  if (!cursor) {
    return prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM ${quoteIdent(table)} ORDER BY ${order} LIMIT ${PAGE_SIZE}`,
    );
  }
  if (cursor.length !== pk.length) throw new BackupInputError("Cursor de backup inválido.");
  const lhs = pk.map((column) => quoteIdent(column.name)).join(", ");
  const rhs = pk.map((column, index) => `$${index + 1}${column.cast}`).join(", ");
  return prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM ${quoteIdent(table)} WHERE (${lhs}) > (${rhs}) ORDER BY ${order} LIMIT ${PAGE_SIZE}`,
    ...cursor,
  );
}

export async function readBackupChunk(
  table: string,
  cursor: string[] | null,
): Promise<{ sql: string; rows: number; nextCursor: string[] | null; done: boolean }> {
  quoteIdent(table);
  const shapes = await loadShapes([table]);
  const shape = shapes.get(table);
  if (!shape) throw new BackupInputError(`Tabela ${table} não encontrada.`);

  const parts: string[] = [];
  let rows = 0;
  let used = 0;
  let current = cursor;
  let done = false;
  let pages = 0;

  while (pages < MAX_PAGES_PER_REQUEST && used < BACKUP_CHUNK_MAX_CHARS) {
    pages += 1;
    const page = await fetchPage(table, shape.pk, current);
    if (page.length === 0) {
      done = true;
      break;
    }
    const remaining = BACKUP_CHUNK_MAX_CHARS - used;
    const taken = takeRowsForChunk(table, shape.columns, page, remaining);
    if (taken.consumed === 0) {
      if (rows > 0) break;
      throw new Error(`Não foi possível exportar uma linha de ${table}.`);
    }
    if (rows === 0 && cursor === null) parts.push(`-- ${table}`);
    parts.push(taken.sql);
    rows += taken.consumed;
    used += taken.sql.length + 1;
    current = cursorFromRow(page[taken.consumed - 1]!, shape.pk);
    if (taken.consumed < page.length) break;
    if (page.length < PAGE_SIZE) {
      done = true;
      break;
    }
  }

  return {
    sql: parts.join("\n"),
    rows,
    nextCursor: done ? null : current,
    done,
  };
}
