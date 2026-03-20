"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { SupportTicketFileUpload } from "@/components/support/SupportTicketFileUpload";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

export default function SuporteNovoPage() {
  const router = useRouter();
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !subject.trim() || summary.trim().length < 10) return;
    setSaving(true);
    try {
      const res = await fetch("/api/me/support", {
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
      const json = (await res.json()) as ApiResponse<{ ticket: { id: string } }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro" : "Falha ao criar chamado.");
        return;
      }
      toast.push("success", "Chamado criado. Você receberá um e-mail de confirmação com o protocolo.");
      router.push(`/suporte/${json.data!.ticket.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <Link href="/suporte" className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Voltar aos chamados
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          Novo chamado
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Descreva seu problema ou dúvida. O suporte responderá por aqui e você receberá um e-mail a cada atualização.
        </p>
      </header>

      <form onSubmit={submit} className="card max-w-2xl">
        <div className="card-body flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Assunto</label>
            <Input
              className="mt-1"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: Não consigo acessar a aula X"
              minLength={3}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Descrição do problema</label>
            <textarea
              className="mt-1 w-full min-h-[160px] rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Descreva com o máximo de detalhes: o que você estava fazendo, qual mensagem apareceu (se houver), navegador e dispositivo."
              minLength={10}
              required
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Mínimo 10 caracteres.</p>
          </div>
          <div>
            <SupportTicketFileUpload
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
                    <li key={`${url}-${idx}`} className="flex items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] p-2">
                      {isImage ? (
                        <img src={url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                      ) : (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--card-border)] text-[var(--text-muted)]" title="Abrir">📎</a>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]" title={name}>{name || "Anexo"}</span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-red-600 shrink-0"
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
              {saving ? "Enviando…" : "Enviar chamado"}
            </Button>
            <Link
              href="/suporte"
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 hover:opacity-90 hover:brightness-95 disabled:opacity-50"
            >
              Cancelar
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
