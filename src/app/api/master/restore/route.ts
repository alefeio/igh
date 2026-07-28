import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";
import {
  executeSqlStatements,
  isPrismaFallbackBackup,
  splitSqlStatements,
} from "@/lib/restore-prisma-sql";

export const maxDuration = 300;

const MAX_CHUNK_CHARS = 900_000; // margem sob o limite ~4.5 MB da Vercel

type ChunkBody = {
  /** Lote de SQL (vários statements completos). */
  sql: string;
  /** Índice do lote (0-based), só para log/UI. */
  chunkIndex?: number;
  /** Total de lotes. */
  chunkTotal?: number;
};

/**
 * Restaura o banco a partir de dump SQL (apenas MASTER).
 *
 * Preferência: backup gerado por Prisma (`-- Backup gerado por Prisma`),
 * executado via `$executeRawUnsafe` em chunks (compatível com Vercel).
 *
 * Body JSON: `{ sql: string, chunkIndex?: number, chunkTotal?: number }`
 * Cada request deve trazer statements SQL completos (terminados em `;`).
 */
export async function POST(request: Request) {
  try {
    await requireRole("MASTER");
  } catch {
    return jsonErr("FORBIDDEN", "Apenas o perfil Master pode restaurar o banco.", 403);
  }

  const contentType = request.headers.get("content-type") ?? "";

  // Multipart legado (arquivos pequenos). Em Vercel, arquivos grandes retornam 413 antes daqui.
  if (contentType.includes("multipart/form-data")) {
    let file: File;
    try {
      const formData = await request.formData();
      const f = formData.get("file");
      if (!f || !(f instanceof File)) {
        return jsonErr("VALIDATION_ERROR", "Envie um arquivo de backup (campo 'file').", 400);
      }
      file = f;
    } catch {
      return jsonErr(
        "VALIDATION_ERROR",
        "Requisição inválida ou arquivo grande demais para upload único. Use o restore em partes da página Backup.",
        400,
      );
    }

    const sqlText = Buffer.from(await file.arrayBuffer()).toString("utf8");
    if (!isPrismaFallbackBackup(sqlText)) {
      return jsonErr(
        "RESTORE_ERROR",
        "Na Vercel só é possível restaurar backups gerados por esta aplicação (formato Prisma). Arquivos pg_dump devem ser restaurados localmente com psql.",
        400,
      );
    }

    try {
      const statements = splitSqlStatements(sqlText);
      const { executed } = await executeSqlStatements(statements);
      return jsonOk({
        message: "Banco restaurado com sucesso.",
        executed,
        chunkIndex: 0,
        chunkTotal: 1,
      });
    } catch (e) {
      console.error("[restore] prisma exec", e);
      return jsonErr(
        "RESTORE_ERROR",
        `Restauração falhou: ${e instanceof Error ? e.message : String(e)}`,
        503,
      );
    }
  }

  let body: ChunkBody;
  try {
    body = (await request.json()) as ChunkBody;
  } catch {
    return jsonErr(
      "VALIDATION_ERROR",
      "Envie JSON `{ sql }` com um lote de statements, ou multipart com o arquivo (somente se for pequeno).",
      400,
    );
  }

  const sql = typeof body.sql === "string" ? body.sql : "";
  if (!sql.trim()) {
    return jsonErr("VALIDATION_ERROR", "Campo sql vazio.", 400);
  }
  if (sql.length > MAX_CHUNK_CHARS * 1.2) {
    return jsonErr(
      "PAYLOAD_TOO_LARGE",
      "Lote SQL grande demais. Reduza o tamanho do chunk no cliente.",
      413,
    );
  }

  // No primeiro chunk, validar formato quando o texto ainda contém o cabeçalho.
  if ((body.chunkIndex ?? 0) === 0 && sql.includes("Backup gerado") && !isPrismaFallbackBackup(sql)) {
    return jsonErr("RESTORE_ERROR", "Formato de backup não reconhecido.", 400);
  }
  if ((body.chunkIndex ?? 0) === 0 && !sql.includes("TRUNCATE") && !sql.includes("INSERT")) {
    // Pode ser só cabeçalho — ok
  }

  try {
    const statements = splitSqlStatements(sql);
    if (statements.length === 0) {
      return jsonOk({
        message: "Lote vazio (só comentários).",
        executed: 0,
        chunkIndex: body.chunkIndex ?? 0,
        chunkTotal: body.chunkTotal ?? 1,
      });
    }
    const { executed } = await executeSqlStatements(statements);
    return jsonOk({
      message:
        body.chunkTotal != null && body.chunkIndex != null && body.chunkIndex + 1 >= body.chunkTotal
          ? "Banco restaurado com sucesso."
          : `Lote ${((body.chunkIndex ?? 0) + 1)}/${body.chunkTotal ?? "?"} aplicado.`,
      executed,
      chunkIndex: body.chunkIndex ?? 0,
      chunkTotal: body.chunkTotal ?? 1,
    });
  } catch (e) {
    console.error("[restore] chunk", body.chunkIndex, e);
    return jsonErr(
      "RESTORE_ERROR",
      `Falha no lote ${(body.chunkIndex ?? 0) + 1}: ${e instanceof Error ? e.message : String(e)}`,
      503,
    );
  }
}
