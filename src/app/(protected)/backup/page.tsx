"use client";

import { useState } from "react";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";
import {
  exportedRowsLookComplete,
  renderBackupPreamble,
  type BackupTableCount,
} from "@/lib/backup-sql";
import { isMasterOrGeneralAdmin } from "@/lib/rbac";

/** Abaixo do limite ~4.5 MB da Vercel; lotes menores evitam timeout da function. */
const MAX_CHUNK_CHARS = 800_000;
const MAX_STATEMENTS_PER_CHUNK = 40;

function stripSqlComments(block: string): string {
  return block
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith("--");
    })
    .join("\n");
}

function splitSqlStatements(sql: string): string[] {
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

function batchStatements(statements: string[], maxChars: number, maxStatements: number): string[] {
  const batches: string[] = [];
  let current: string[] = [];
  let size = 0;

  for (const stmt of statements) {
    const extra = stmt.length + 2;
    const wouldExceed =
      current.length > 0 &&
      (size + extra > maxChars || current.length >= maxStatements);
    if (wouldExceed) {
      batches.push(current.map((s) => `${s};`).join("\n"));
      current = [];
      size = 0;
    }
    if (stmt.length > maxChars && current.length === 0) {
      batches.push(`${stmt};`);
      continue;
    }
    current.push(stmt);
    size += extra;
  }
  if (current.length > 0) {
    batches.push(current.map((s) => `${s};`).join("\n"));
  }
  return batches;
}

async function readResponseJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    if (res.status === 413 || /payload too large|entity too large|Request Entity/i.test(text)) {
      throw new Error(
        "Arquivo grande demais para a Vercel (limite ~4,5 MB por requisição). O restore em partes deveria evitar isso — atualize a página e tente de novo.",
      );
    }
    throw new Error(
      res.ok
        ? "Resposta inválida do servidor."
        : `Erro no servidor (${res.status}). ${text.slice(0, 160)}`,
    );
  }
}

export default function BackupPage() {
  const user = useUser();
  const isMaster = isMasterOrGeneralAdmin(user);
  const toast = useToast();
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  async function handleBackup() {
    setBackupLoading(true);
    setBackupProgress("Contando registros…");
    try {
      const metaRes = await fetch("/api/master/backup?part=meta");
      const metaJson = await readResponseJson<
        ApiResponse<{ generatedAt: string; tables: BackupTableCount[]; totalRows: number }>
      >(metaRes);
      if (!metaJson || !metaRes.ok || !metaJson.ok) {
        const msg =
          metaJson && !metaJson.ok && "error" in metaJson
            ? metaJson.error.message
            : "Falha ao gerar backup.";
        toast.push("error", msg);
        return;
      }

      const { generatedAt, tables, totalRows } = metaJson.data;
      const parts: string[] = [renderBackupPreamble({ generatedAt, tables })];
      let exported = 0;

      for (let index = 0; index < tables.length; index++) {
        const table = tables[index]!;
        if (table.rowCount === 0) continue;
        let cursor: string | null = null;
        let tableRows = 0;
        for (;;) {
          setBackupProgress(
            `Tabela ${index + 1} de ${tables.length} · ${table.name} · ${tableRows.toLocaleString("pt-BR")} de ${table.rowCount.toLocaleString("pt-BR")}`,
          );
          const params = new URLSearchParams({ part: "chunk", table: table.name });
          if (cursor) params.set("cursor", cursor);
          const res = await fetch(`/api/master/backup?${params.toString()}`);
          const json = await readResponseJson<
            ApiResponse<{ sql: string; rows: number; done: boolean; nextCursor: string | null }>
          >(res);
          if (!json || !res.ok || !json.ok) {
            const msg =
              json && !json.ok && "error" in json
                ? json.error.message
                : `Falha ao exportar ${table.name}.`;
            toast.push("error", msg);
            return;
          }
          const chunk = json.data;
          if (!chunk.done && chunk.rows <= 0) {
            toast.push("error", `Backup interrompido na tabela ${table.name}. O arquivo não foi salvo.`);
            return;
          }
          if (chunk.sql) parts.push(chunk.sql);
          tableRows += chunk.rows;
          exported += chunk.rows;
          if (chunk.done) break;
          if (!chunk.nextCursor || chunk.nextCursor === cursor) {
            toast.push("error", `Backup interrompido na tabela ${table.name}. O arquivo não foi salvo.`);
            return;
          }
          cursor = chunk.nextCursor;
        }
        if (!exportedRowsLookComplete(tableRows, table.rowCount)) {
          toast.push(
            "error",
            `A tabela ${table.name} exportou ${tableRows.toLocaleString("pt-BR")} de ${table.rowCount.toLocaleString("pt-BR")} registros. O arquivo não foi salvo.`,
          );
          return;
        }
      }

      parts.push(`-- backup-complete rows=${exported}\n`);
      const sql = parts.join("\n");
      if (!sql.includes("Backup gerado por Prisma") || !sql.includes("-- backup-complete")) {
        toast.push("error", "O backup ficou incompleto e não foi salvo.");
        return;
      }
      const blob = new Blob([sql], { type: "application/sql" });
      const filename = `backup-${generatedAt.slice(0, 19).replace(/[:-]/g, "")}.sql`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const mb = blob.size / (1024 * 1024);
      const sizeLabel = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(blob.size / 1024))} KB`;
      toast.push(
        "success",
        `Backup baixado (${sizeLabel}, ${exported.toLocaleString("pt-BR")} de ${totalRows.toLocaleString("pt-BR")} registros).`,
      );
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Erro ao gerar backup.");
    } finally {
      setBackupLoading(false);
      setBackupProgress(null);
    }
  }

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreFile) {
      toast.push("error", "Selecione um arquivo de backup.");
      return;
    }
    setRestoreLoading(true);
    setRestoreProgress("Lendo arquivo…");
    try {
      const sqlText = await restoreFile.text();
      if (!sqlText.includes("Backup gerado por Prisma")) {
        toast.push(
          "error",
          "Este arquivo não é o formato Prisma desta aplicação. Na Vercel, use um .sql gerado em «Baixar backup». Dump pg_dump deve ser restaurado localmente com psql.",
        );
        return;
      }

      const statements = splitSqlStatements(sqlText);
      if (statements.length === 0) {
        toast.push("error", "Arquivo SQL sem statements utilizáveis.");
        return;
      }

      const batches = batchStatements(statements, MAX_CHUNK_CHARS, MAX_STATEMENTS_PER_CHUNK);
      const oversized = batches.find((b) => b.length > MAX_CHUNK_CHARS * 1.15);
      if (oversized) {
        toast.push(
          "error",
          "Há um INSERT grande demais para um único lote na Vercel. Restaure localmente com psql usando a URL do banco da INAC.",
        );
        return;
      }

      for (let i = 0; i < batches.length; i++) {
        setRestoreProgress(`Enviando lote ${i + 1} de ${batches.length}…`);
        const res = await fetch("/api/master/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sql: batches[i],
            chunkIndex: i,
            chunkTotal: batches.length,
          }),
        });
        const json = await readResponseJson<
          ApiResponse<{ message?: string; executed?: number }>
        >(res);
        if (!json || !res.ok || !json.ok) {
          const msg =
            json && !json.ok && "error" in json
              ? json.error.message
              : `Falha ao restaurar (lote ${i + 1}/${batches.length}).`;
          toast.push("error", msg);
          return;
        }
      }

      toast.push("success", `Banco restaurado com sucesso (${batches.length} lote(s)).`);
      setRestoreFile(null);
      if (typeof document !== "undefined" && document.querySelector('input[type="file"]')) {
        (document.querySelector('input[type="file"]') as HTMLInputElement).value = "";
      }
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Erro ao restaurar.");
    } finally {
      setRestoreLoading(false);
      setRestoreProgress(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        eyebrow="Master"
        title="Backup e restauração do banco"
        description="Download de dump completo (.sql) ou restauração a partir do arquivo gerado aqui. Operações sensíveis — use com cuidado."
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <SectionCard
          title="Fazer backup"
          description="Dump completo do schema public: todas as tabelas e registros."
          variant="elevated"
        >
          <p className="text-xs text-[var(--text-muted)]">
            O arquivo é montado em partes, com todas as tabelas e registros do schema public. O download só
            começa depois que a contagem de cada tabela fecha. Pode levar alguns minutos.
          </p>
          <div className="mt-4">
            <Button type="button" variant="primary" onClick={handleBackup} disabled={backupLoading}>
              {backupLoading ? "Gerando backup..." : "Baixar backup do banco"}
            </Button>
            {backupProgress ? (
              <p className="mt-3 text-xs font-medium text-[var(--igh-primary)]">{backupProgress}</p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="Restaurar banco"
          description="Substitui o conteúdo das tabelas (TRUNCATE + INSERTs). Irreversível."
          variant="elevated"
        >
          {isMaster ? (
            <>
              <p className="text-xs text-[var(--text-muted)]">
                Use um <strong>.sql gerado por este backup</strong> (formato Prisma). Arquivos grandes são
                enviados em partes para contornar o limite da Vercel (~4,5 MB por requisição).
              </p>
              <form onSubmit={handleRestore} className="mt-4 flex flex-col gap-3">
                <input
                  type="file"
                  accept=".sql,text/plain"
                  className="w-full text-sm text-[var(--text-primary)] file:mr-2 file:rounded file:border file:border-[var(--card-border)] file:bg-[var(--igh-surface)] file:px-3 file:py-1.5 file:text-sm"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                />
                {restoreProgress ? (
                  <p className="text-xs font-medium text-[var(--igh-primary)]">{restoreProgress}</p>
                ) : null}
                <Button type="submit" variant="secondary" disabled={restoreLoading || !restoreFile}>
                  {restoreLoading ? "Restaurando..." : "Restaurar banco"}
                </Button>
              </form>
              <details className="mt-4 text-xs text-[var(--text-muted)]">
                <summary className="cursor-pointer font-medium text-[var(--text-secondary)]">
                  Alternativa local (psql)
                </summary>
                <p className="mt-2 leading-relaxed">
                  Se o restore na Vercel falhar (timeout ou INSERT enorme), no seu PC:
                </p>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] p-2 text-[11px]">
{`$env:APP_DIRECT_URL="postgres://…@db.prisma.io:5432/postgres?sslmode=verify-full"
psql $env:APP_DIRECT_URL -v ON_ERROR_STOP=1 -f .\\backup-igh.sql`}
                </pre>
              </details>
            </>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              Apenas o usuário <strong>Master</strong> pode restaurar o banco a partir de um arquivo .sql.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
