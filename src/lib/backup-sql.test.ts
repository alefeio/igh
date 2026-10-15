import { describe, expect, it } from "vitest";

import {
  BACKUP_SQL_MARKER,
  decodeBackupCursor,
  encodeBackupCursor,
  exportedRowsLookComplete,
  insertStatement,
  quoteIdent,
  renderBackupPreamble,
  sqlLiteral,
  takeRowsForChunk,
  type SqlColumn,
} from "@/lib/backup-sql";

const columns: SqlColumn[] = [
  { name: "id", kind: "scalar" },
  { name: "name", kind: "scalar" },
  { name: "meta", kind: "json" },
  { name: "tags", kind: "array" },
];

describe("SQL do backup", () => {
  it("recusa identificador que sairia do nome da tabela", () => {
    expect(() => quoteIdent('users"; DROP TABLE "User"')).toThrow(/inválido/);
  });

  it("grava JSON array como jsonb e array SQL como literal de array", () => {
    expect(sqlLiteral(["a", "b"], "json")).toBe(`'["a","b"]'::jsonb`);
    expect(sqlLiteral(["a", "b"], "array")).toBe(`'{"a","b"}'`);
    expect(sqlLiteral("O'Brien")).toBe(`'O''Brien'`);
  });

  it("monta o cabeçalho com o marcador do restore e o TRUNCATE de todas as tabelas", () => {
    const sql = renderBackupPreamble({
      generatedAt: "2026-10-15T18:00:00.000Z",
      tables: [
        { name: "User", rowCount: 2 },
        { name: "Enrollment", rowCount: 0 },
      ],
    });
    expect(sql.startsWith(BACKUP_SQL_MARKER)).toBe(true);
    expect(sql).toContain('TRUNCATE TABLE "User", "Enrollment" CASCADE;');
    expect(sql).toContain("-- Registros: 2");
  });

  it("não descarta o restante das linhas quando o lote enche", () => {
    const rows = Array.from({ length: 60 }, (_, index) => ({
      id: String(index),
      name: "x".repeat(80),
      meta: { index },
      tags: ["a"],
    }));
    const taken = takeRowsForChunk("User", columns, rows, 4_000);
    expect(taken.consumed).toBeGreaterThan(0);
    expect(taken.consumed).toBeLessThan(rows.length);
    expect(taken.sql).toContain('INSERT INTO "User"');
    const rest = takeRowsForChunk("User", columns, rows.slice(taken.consumed), 1_000_000);
    expect(taken.consumed + rest.consumed).toBe(rows.length);
  });

  it("parte INSERT em lotes de 50 linhas", () => {
    const rows = Array.from({ length: 60 }, (_, index) => ({ id: String(index), name: "a" }));
    const sql = takeRowsForChunk("User", columns.slice(0, 2), rows, 1_000_000).sql;
    expect(sql.match(/INSERT INTO/g)).toHaveLength(2);
    expect(insertStatement("User", columns.slice(0, 2), rows.slice(0, 1))).toContain("VALUES");
  });

  it("só aceita a tabela como completa quando a contagem fecha", () => {
    expect(exportedRowsLookComplete(171000, 171106)).toBe(true);
    expect(exportedRowsLookComplete(8000, 171106)).toBe(false);
    expect(exportedRowsLookComplete(0, 12)).toBe(false);
    expect(exportedRowsLookComplete(0, 0)).toBe(true);
  });

  it("reabre o cursor sem alterar os valores", () => {
    const encoded = encodeBackupCursor(["abc", "def"]);
    expect(decodeBackupCursor(encoded)).toEqual(["abc", "def"]);
    expect(() => decodeBackupCursor("%%%")).toThrow(/Cursor/);
  });
});
