import { prisma } from "@/lib/prisma";

/** Escapa um valor para uso em literal SQL (INSERT). */
function sqlLiteral(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number" && !Number.isNaN(val)) return String(val);
  if (val instanceof Date) return `'${val.toISOString().replace(/'/g, "''")}'`;
  if (Buffer.isBuffer(val)) return `'\\x${val.toString("hex")}'`;
  const s = String(val);
  return `'${s.replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
}

/**
 * Retorna os nomes das tabelas do schema public em ordem que respeita FKs
 * (tabelas referenciadas antes das que referenciam), para INSERTs na restauração.
 */
async function getTableNamesInOrder(): Promise<string[]> {
  const list = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  const allTables = new Set(list.map((r) => r.tablename));

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
  for (const t of allTables) {
    outDegree[t] = 0;
    childrenOf[t] = [];
  }
  for (const { child, parent } of edges) {
    if (!allTables.has(child) || !allTables.has(parent) || child === parent) continue;
    outDegree[child] = (outDegree[child] ?? 0) + 1;
    if (!childrenOf[parent]) childrenOf[parent] = [];
    childrenOf[parent].push(child);
  }

  const order: string[] = [];
  const queue = [...allTables].filter((t) => outDegree[t] === 0);
  while (queue.length) {
    const t = queue.shift()!;
    order.push(t);
    for (const c of childrenOf[t] ?? []) {
      outDegree[c]--;
      if (outDegree[c] === 0) queue.push(c);
    }
  }
  const remaining = [...allTables].filter((t) => !order.includes(t));
  return [...order, ...remaining];
}

/**
 * Retorna as colunas de uma tabela (ordem).
 */
async function getColumnNames(tableName: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;
  return rows.map((r) => r.column_name);
}

/**
 * Gera SQL de backup (TRUNCATE + INSERTs) usando apenas Prisma/Node.
 * Formato compatível com a restauração: não usa DROP SCHEMA (o restore detecta e não faz DROP quando for este formato).
 */
export async function generateBackupSql(): Promise<string> {
  const lines: string[] = [];
  lines.push("-- Backup gerado por Prisma (fallback, sem pg_dump)");
  lines.push(`-- Data: ${new Date().toISOString()}`);
  lines.push("");

  const tableNames = await getTableNamesInOrder();
  if (tableNames.length === 0) return lines.join("\n");

  lines.push("-- Limpar tabelas (ordem não importa com CASCADE)");
  lines.push(`TRUNCATE TABLE ${tableNames.map((t) => `"${t}"`).join(", ")} CASCADE;`);
  lines.push("");

  for (const tableName of tableNames) {
    const columns = await getColumnNames(tableName);
    if (columns.length === 0) continue;

    const quotedCols = columns.map((c) => `"${c}"`).join(", ");
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "${tableName.replace(/"/g, '""')}"`
    ) as Record<string, unknown>[];

    if (rows.length === 0) continue;

    lines.push(`-- ${tableName}`);
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch
        .map(
          (row) =>
            `(${columns.map((col) => sqlLiteral(row[col])).join(", ")})`
        )
        .join(",\n");
      lines.push(`INSERT INTO "${tableName.replace(/"/g, '""')}" (${quotedCols}) VALUES`);
      lines.push(values);
      lines.push(";");
    }
    lines.push("");
  }

  return lines.join("\n");
}
