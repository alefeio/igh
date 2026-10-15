import { requireRole } from "@/lib/auth";
import {
  getBackupManifest,
  readBackupChunk,
} from "@/lib/backup-prisma";
import { BackupInputError, decodeBackupCursor, encodeBackupCursor } from "@/lib/backup-sql";
import { jsonErr, jsonOk } from "@/lib/http";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const noStore = { headers: { "Cache-Control": "no-store" } };

/**
 * Backup completo do schema public (apenas MASTER).
 * O arquivo é montado no navegador em partes, porque um único response da Vercel
 * corta dumps grandes e a página acabava salvando um arquivo incompleto.
 */
export async function GET(request: Request) {
  try {
    await requireRole("MASTER");
  } catch {
    return jsonErr("FORBIDDEN", "Apenas perfis autorizados podem fazer backup.", 403);
  }

  const part = new URL(request.url).searchParams.get("part") ?? "";

  try {
    if (part === "meta") {
      return jsonOk(await getBackupManifest(), noStore);
    }
    if (part === "chunk") {
      const table = new URL(request.url).searchParams.get("table") ?? "";
      const cursorRaw = new URL(request.url).searchParams.get("cursor");
      const cursor = cursorRaw ? decodeBackupCursor(cursorRaw) : null;
      const chunk = await readBackupChunk(table, cursor);
      if (!chunk.done && !chunk.nextCursor) {
        throw new Error(`Backup da tabela ${table} não avançou.`);
      }
      return jsonOk(
        {
          sql: chunk.sql,
          rows: chunk.rows,
          done: chunk.done,
          nextCursor: chunk.nextCursor ? encodeBackupCursor(chunk.nextCursor) : null,
        },
        noStore,
      );
    }
    return jsonErr("VALIDATION_ERROR", "Informe part=meta ou part=chunk.", 400);
  } catch (error) {
    if (error instanceof BackupInputError) {
      return jsonErr("VALIDATION_ERROR", error.message, 400);
    }
    console.error("[backup]", part, error instanceof Error ? error.message : error);
    return jsonErr("BACKUP_ERROR", "Falha ao gerar o backup. Tente de novo.", 500);
  }
}
