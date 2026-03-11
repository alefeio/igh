import { spawn } from "node:child_process";
import { requireRole } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Retorna a URL de conexão do banco (para psql). */
function getConnectionString(): string {
  const u =
    process.env.POSTGRES_URL ??
    process.env.PRISMA_DATABASE_URL ??
    process.env.DATABASE_URL;
  if (!u) throw new Error("URL de banco não configurada.");
  return u;
}

/**
 * Restaura o banco a partir de um arquivo de backup (apenas MASTER).
 * Aceita o mesmo formato gerado pelo backup (dump SQL em texto).
 * Requer psql instalado no servidor.
 */
export async function POST(request: Request) {
  try {
    await requireRole("MASTER");
  } catch {
    return jsonErr("FORBIDDEN", "Apenas o perfil Master pode restaurar o banco.", 403);
  }

  let file: File;
  try {
    const formData = await request.formData();
    const f = formData.get("file");
    if (!f || !(f instanceof File)) {
      return jsonErr("VALIDATION_ERROR", "Envie um arquivo de backup (campo 'file').", 400);
    }
    file = f;
  } catch {
    return jsonErr("VALIDATION_ERROR", "Requisição inválida. Use multipart/form-data com o campo 'file'.", 400);
  }

  const connectionString = getConnectionString();
  const sqlBuffer = Buffer.from(await file.arrayBuffer());
  const sqlText = sqlBuffer.toString("utf8");

  // Backup gerado pelo fallback Prisma (sem pg_dump) já contém TRUNCATE + INSERTs; não fazer DROP SCHEMA.
  const isPrismaFallback = sqlText.includes("Backup gerado por Prisma");

  const dropAndRecreateSchema = Buffer.from(
    "DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\nGRANT ALL ON SCHEMA public TO public;\n\n",
    "utf8"
  );
  const fullSql = isPrismaFallback ? sqlBuffer : Buffer.concat([dropAndRecreateSchema, sqlBuffer]);

  return new Promise<Response>((resolve) => {
    const child = spawn("psql", [connectionString, "-v", "ON_ERROR_STOP=1"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const errChunks: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    child.on("error", (err) => {
      resolve(
        jsonErr(
          "RESTORE_ERROR",
          "Não foi possível executar a restauração. Verifique se o psql está instalado e no PATH (ex.: PostgreSQL client tools). " +
            (err?.message ?? ""),
          503
        )
      );
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const errMsg = Buffer.concat(errChunks).toString("utf8").trim() || "psql falhou.";
        resolve(
          jsonErr(
            "RESTORE_ERROR",
            `Restauração falhou: ${errMsg}. Use um arquivo .sql gerado pelo backup desta aplicação.`,
            503
          )
        );
        return;
      }
      resolve(jsonOk({ message: "Banco restaurado com sucesso." }));
    });

    child.stdin.write(fullSql, (err) => {
      if (err) {
        resolve(jsonErr("RESTORE_ERROR", "Erro ao enviar dados para psql: " + err.message, 500));
        return;
      }
      child.stdin.end();
    });
  });
}
