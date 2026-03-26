"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CoordinatorReportFileUpload } from "@/components/coordenacao/CoordinatorReportFileUpload";
import { useToast } from "@/components/feedback/ToastProvider";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type Msg = {
  id: string;
  content: string;
  isFromCoordinator: boolean;
  attachmentUrls: string[];
  attachmentNames: string[];
  createdAt: string;
  author: { id: string; name: string };
};

type Report = {
  id: string;
  protocolNumber: string;
  subject: string;
  summary: string;
  status: string;
  attachmentUrls: string[];
  attachmentNames: string[];
  createdAt: string;
  updatedAt: string;
  fromUser: { id: string; name: string; email: string };
  messages: Msg[];
};

export default function CoordenacaoReportePage() {
  const params = useParams();
  const toast = useToast();
  const user = useUser();
  const id = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [replyUrls, setReplyUrls] = useState<string[]>([]);
  const [replyNames, setReplyNames] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  const isCoordinator = user.role === "COORDINATOR";
  const canReply = report && report.status !== "CLOSED";

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/coordinator-reports/${id}`, { credentials: "include" })
      .then((r) => r.json() as Promise<ApiResponse<{ report: Report }>>)
      .then((json) => {
        if (json?.ok && json.data?.report) setReport(json.data.report);
        else setReport(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!report) return;
    fetch(`/api/coordinator-reports/${id}/read`, { method: "POST", credentials: "include" })
      .catch(() => {})
      .finally(() => {
        window.dispatchEvent(new CustomEvent("coordinator-report-badge-refetch"));
      });
  }, [id, report]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending || !canReply) return;
    setSending(true);
    try {
      const res = await fetch(`/api/coordinator-reports/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: reply.trim(),
          attachmentUrls: replyUrls,
          attachmentNames: replyNames.slice(0, replyUrls.length),
        }),
      });
      const json = (await res.json()) as ApiResponse<{ message: Msg }>;
      if (!res.ok || !json.ok) {
        toast.push(
          "error",
          !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro" : "Falha ao enviar.",
        );
        return;
      }
      toast.push("success", "Mensagem enviada.");
      setReply("");
      setReplyUrls([]);
      setReplyNames([]);
      load();
    } finally {
      setSending(false);
    }
  }

  async function closeThread() {
    if (!report || report.status === "CLOSED" || closing) return;
    if (!confirm("Encerrar este reporte? Não será possível enviar novas mensagens.")) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/coordinator-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "CLOSED" }),
      });
      const json = (await res.json()) as ApiResponse<{ status: string }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro" : "Erro ao encerrar.");
        return;
      }
      toast.push("success", "Reporte encerrado.");
      load();
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-12 text-center text-[var(--text-muted)]">
        Carregando…
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-12 text-center">
        <p className="text-[var(--text-muted)]">Reporte não encontrado.</p>
        <Link href="/coordenacao" className="mt-3 inline-block text-sm text-[var(--igh-primary)] hover:underline">
          Voltar à lista
        </Link>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    OPEN: "Aberto",
    ANSWERED: "Respondido",
    CLOSED: "Encerrado",
  };

  function renderAttachments(urls: string[], names: string[]) {
    if (!urls?.length) return null;
    return (
      <ul className="mt-2 flex flex-wrap gap-2">
        {urls.map((url, idx) => {
          const isImage = url.includes("/image/upload/");
          const name = names[idx] ?? url;
          return (
            <li key={`${url}-${idx}`}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-1 text-xs text-[var(--igh-primary)] hover:underline"
              >
                {isImage ? <img src={url} alt="" className="h-8 w-8 rounded object-cover" /> : <span>📎</span>}
                <span className="max-w-[12rem] truncate">{name}</span>
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <Link href="/coordenacao" className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Voltar à lista
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-[var(--igh-primary)] sm:text-xl">{report.protocolNumber}</h1>
            <span className="rounded-full bg-[var(--igh-surface)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {statusLabel[report.status] ?? report.status}
            </span>
          </div>
          {report.status !== "CLOSED" && (
            <Button type="button" variant="secondary" size="sm" onClick={closeThread} disabled={closing}>
              {closing ? "Encerrando…" : "Encerrar conversa"}
            </Button>
          )}
        </div>
        <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{report.subject}</h2>
        {isCoordinator && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            De: <strong>{report.fromUser.name}</strong> ({report.fromUser.email})
          </p>
        )}
      </header>

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Mensagem inicial</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{report.summary}</p>
          {renderAttachments(report.attachmentUrls ?? [], report.attachmentNames ?? [])}
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {new Date(report.createdAt).toLocaleString("pt-BR")}
          </p>
        </div>

        {report.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.isFromCoordinator
                ? "border-sky-500/30 bg-sky-500/5"
                : "border-[var(--card-border)] bg-[var(--igh-surface)]/80"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {m.isFromCoordinator ? "Coordenação" : m.author.name}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {new Date(m.createdAt).toLocaleString("pt-BR")}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{m.content}</p>
            {renderAttachments(m.attachmentUrls ?? [], m.attachmentNames ?? [])}
          </div>
        ))}
      </div>

      {canReply && (
        <form onSubmit={sendReply} className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <label className="text-sm font-medium text-[var(--text-primary)]">
            {isCoordinator ? "Sua resposta" : "Nova mensagem"}
          </label>
          <textarea
            className="mt-1 w-full min-h-[100px] rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Escreva sua mensagem…"
          />
          <div className="mt-3">
            <CoordinatorReportFileUpload
              label="Anexos (opcional)"
              multiple
              onUploaded={(url, fileName) => {
                setReplyUrls((prev) => (prev.length >= 20 ? prev : [...prev, url]));
                setReplyNames((prev) => (prev.length >= 20 ? prev : [...prev, fileName ?? ""]));
              }}
            />
            {replyUrls.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                {replyUrls.map((url, idx) => (
                  <li key={`${url}-${idx}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">{replyNames[idx] ?? "Anexo"}</span>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => {
                        setReplyUrls((p) => p.filter((_, i) => i !== idx));
                        setReplyNames((p) => p.filter((_, i) => i !== idx));
                      }}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={sending || !reply.trim()}>
              {sending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </form>
      )}

      {report.status === "CLOSED" && (
        <p className="text-center text-sm text-[var(--text-muted)]">Esta conversa foi encerrada.</p>
      )}
    </div>
  );
}
