import { spawn } from "node:child_process";
import { requireRole } from "@/lib/auth";
import { getDatabaseConnectionString } from "@/lib/database-url";
import { generateBackupSql } from "@/lib/backup-prisma";
import { jsonErr } from "@/lib/http";

/**
 * Backup completo do banco (apenas MASTER).
 * Tenta pg_dump; se não estiver instalado (ENOENT), usa fallback via Prisma (dados em SQL).
 */
export async function GET() {
  try {
    await requireRole("MASTER");
  } catch {
    return jsonErr("FORBIDDEN", "Apenas perfis autorizados podem fazer backup.", 403);
  }

  const connectionString = getDatabaseConnectionString();
  const filename = `backup-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.sql`;

  return new Promise<Response>((resolve) => {
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const child = spawn("pg_dump", [connectionString, "-F", "p", "--no-owner", "--no-acl"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk: Buffer) => outChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    child.on("error", async (err: NodeJS.ErrnoException) => {
      if (err?.code === "ENOENT") {
        try {
          const sql = await generateBackupSql();
          const body = Buffer.from(sql, "utf8");
          resolve(
            new Response(body, {
              status: 200,
              headers: {
                "Content-Type": "application/sql",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": String(body.length),
              },
            })
          );
        } catch (fallbackErr) {
          resolve(
            jsonErr(
              "BACKUP_ERROR",
              "pg_dump não encontrado e backup alternativo falhou: " +
                (fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)),
              503
            )
          );
        }
        return;
      }
      resolve(
        jsonErr(
          "BACKUP_ERROR",
          "Não foi possível executar o backup. Verifique se o pg_dump está instalado e no PATH (ex.: PostgreSQL client tools). " +
            (err?.message ?? ""),
          503
        )
      );
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        const errMsg = Buffer.concat(errChunks).toString("utf8").trim() || "pg_dump falhou.";
        try {
          const sql = await generateBackupSql();
          const body = Buffer.from(sql, "utf8");
          resolve(
            new Response(body, {
              status: 200,
              headers: {
                "Content-Type": "application/sql",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": String(body.length),
              },
            })
          );
        } catch {
          resolve(
            jsonErr(
              "BACKUP_ERROR",
              `pg_dump falhou (${errMsg}). Backup alternativo também falhou. Verifique POSTGRES_URL/DATABASE_URL e a conexão com o banco.`,
              503
            )
          );
        }
        return;
      }
      const body = Buffer.concat(outChunks);
      resolve(
        new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/sql",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": String(body.length),
          },
        })
      );
    });
  });
}
