import "server-only";

import { prisma } from "@/lib/prisma";

/** Detecta dump gerado por `generateBackupSql` (sem pg_dump). */
export function isPrismaFallbackBackup(sql: string): boolean {
  return sql.includes("Backup gerado por Prisma");
}

/**
 * Divide SQL em statements, respeitando aspas simples ('' escapado).
 * Adequado ao formato TRUNCATE/INSERT do backup Prisma.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingle = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inSingle) {
      current += ch;
      if (ch === "'" && sql[i + 1] === "'") {
        current += sql[++i];
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === ";") {
      const trimmed = stripSqlComments(current).trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }
    current += ch;
  }

  const tail = stripSqlComments(current).trim();
  if (tail) statements.push(tail);
  return statements;
}

function stripSqlComments(block: string): string {
  return block
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith("--");
    })
    .join("\n");
}

/** Agrupa statements em lotes com tamanho máximo de caracteres (para o body HTTP). */
export function batchSqlStatements(statements: string[], maxChars: number): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let size = 0;

  for (const stmt of statements) {
    const extra = stmt.length + 2;
    if (current.length > 0 && size + extra > maxChars) {
      batches.push(current);
      current = [];
      size = 0;
    }
    // Statement maior que o limite: envia sozinho (melhor que falhar em silêncio).
    if (stmt.length > maxChars && current.length === 0) {
      batches.push([stmt]);
      continue;
    }
    current.push(stmt);
    size += extra;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Executa statements SQL via Prisma (sem psql).
 * Usado no restore em Vercel / ambientes sem client PostgreSQL.
 */
export async function executeSqlStatements(statements: string[]): Promise<{ executed: number }> {
  let executed = 0;
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
    executed += 1;
  }
  return { executed };
}
