"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CoordinatorReportFileUpload } from "@/components/coordenacao/CoordinatorReportFileUpload";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useUser } from "@/components/layout/UserProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

export default function CoordenacaoNovoPage() {
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const allowed = user.role === "TEACHER" || user.role === "ADMIN" || user.role === "MASTER";

  useEffect(() => {
    if (!allowed) {
      router.replace("/coordenacao");
    }
  }, [allowed, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !subject.trim() || summary.trim().length < 10) return;
    setSaving(true);
    try {
      const res = await fetch("/api/coordinator-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: subject.trim(),
          summary: summary.trim(),
          attachmentUrls,
          attachmentNames: attachmentNames.slice(0, attachmentUrls.length),
        }),
      });
      const json = (await res.json()) as ApiResponse<{ report: { id: string } }>;
      if (!res.ok || !json.ok) {
        toast.push(
          "error",
          !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro" : "Falha ao enviar.",
        );
        return;
      }
      toast.push("success", "Reporte enviado. A coordenação receberá um e-mail.");
      router.push(`/coordenacao/${json.data!.report.id}`);
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
      <DashboardHero
        eyebrow="Coordenação"
        title="Novo reporte"
        description="Descreva a informação ou notícia que precisa chegar à coordenação. Anexe arquivos se necessário (imagens, PDF, planilhas)."
      />

      <SectionCard title="Formulário" variant="elevated">
        <form onSubmit={submit} className="flex max-w-2xl flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Assunto</label>
            <Input
              className="mt-1"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: Atualização sobre turma X / Material para reunião"
              minLength={3}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Mensagem</label>
            <textarea
              className="mt-1 w-full min-h-[160px] rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)]"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Detalhe o que a coordenação precisa saber."
              minLength={10}
              required
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Mínimo 10 caracteres.</p>
          </div>
          <div>
            <CoordinatorReportFileUpload
              label="Anexos (opcional)"
              multiple
              onUploaded={(url, fileName) => {
                setAttachmentUrls((prev) => (prev.length >= 20 ? prev : [...prev, url]));
                setAttachmentNames((prev) => (prev.length >= 20 ? prev : [...prev, fileName ?? ""]));
              }}
            />
            {attachmentUrls.length > 0 && (
              <ul className="mt-3 space-y-2">
                {attachmentUrls.map((url, idx) => {
                  const isImage = url.includes("/image/upload/");
                  const name = attachmentNames[idx] ?? url;
                  return (
                    <li
                      key={`${url}-${idx}`}
                      className="flex items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-2"
                    >
                      {isImage ? (
                        <img src={url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                      ) : (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--card-border)] text-[var(--text-muted)]"
                          title="Abrir"
                        >
                          📎
                        </a>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]" title={name}>
                        {name || "Anexo"}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0 text-red-600"
                        onClick={() => {
                          setAttachmentUrls((p) => p.filter((_, i) => i !== idx));
                          setAttachmentNames((p) => p.filter((_, i) => i !== idx));
                        }}
                      >
                        Remover
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving || subject.trim().length < 3 || summary.trim().length < 10}>
              {saving ? "Enviando…" : "Enviar reporte"}
            </Button>
            <Link
              href="/coordenacao"
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:opacity-90"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
