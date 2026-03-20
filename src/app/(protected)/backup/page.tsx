"use client";

import { useState } from "react";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

export default function BackupPage() {
  const toast = useToast();
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  async function handleBackup() {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/master/backup");
      if (!res.ok) {
        const json = (await res.json()) as ApiResponse<unknown>;
        const msg = json && !("ok" in json && json.ok) && "error" in json ? (json as { error: { message: string } }).error.message : "Falha ao gerar backup.";
        toast.push("error", msg);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? "backup.sql";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.push("success", "Backup baixado com sucesso.");
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Erro ao gerar backup.");
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreFile) {
      toast.push("error", "Selecione um arquivo de backup.");
      return;
    }
    setRestoreLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", restoreFile);
      const res = await fetch("/api/master/restore", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as ApiResponse<{ message?: string }>;
      if (!res.ok || !json.ok) {
        const msg = json && !("ok" in json && json.ok) && "error" in json ? (json as { error: { message: string } }).error.message : "Falha ao restaurar.";
        toast.push("error", msg);
        return;
      }
      toast.push("success", json.data?.message ?? "Banco restaurado com sucesso.");
      setRestoreFile(null);
      if (typeof document !== "undefined" && document.querySelector('input[type="file"]')) {
        (document.querySelector('input[type="file"]') as HTMLInputElement).value = "";
      }
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Erro ao restaurar.");
    } finally {
      setRestoreLoading(false);
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
          description="Schema e dados em um único arquivo .sql."
          variant="elevated"
        >
          <p className="text-xs text-[var(--text-muted)]">
            Requer <strong>pg_dump</strong> instalado no servidor (ex.: ferramentas do PostgreSQL).
          </p>
          <div className="mt-4">
            <Button
              type="button"
              variant="primary"
              onClick={handleBackup}
              disabled={backupLoading}
            >
              {backupLoading ? "Gerando backup..." : "Baixar backup do banco"}
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Restaurar banco"
          description="Substitui todo o conteúdo do banco. Irreversível."
          variant="elevated"
        >
          <p className="text-xs text-[var(--text-muted)]">
            Requer <strong>psql</strong> instalado no servidor. Use apenas arquivos .sql gerados por este backup.
          </p>
          <form onSubmit={handleRestore} className="mt-4 flex flex-col gap-3">
            <input
              type="file"
              accept=".sql"
              className="w-full text-sm text-[var(--text-primary)] file:mr-2 file:rounded file:border file:border-[var(--card-border)] file:bg-[var(--igh-surface)] file:px-3 file:py-1.5 file:text-sm"
              onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
            />
            <Button type="submit" variant="secondary" disabled={restoreLoading || !restoreFile}>
              {restoreLoading ? "Restaurando..." : "Restaurar banco"}
            </Button>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
