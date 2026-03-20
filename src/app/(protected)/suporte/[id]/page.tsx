"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useUser } from "@/components/layout/UserProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type Message = {
  id: string;
  content: string;
  isFromSupport: boolean;
  createdAt: string;
};

type Ticket = {
  id: string;
  protocolNumber: string;
  subject: string;
  summary: string;
  status: string;
  attachmentUrls: string[];
  attachmentNames: string[];
  createdAt: string;
  updatedAt: string;
  user?: { name: string; email: string };
  messages: Message[];
};

export default function SuporteChamadoPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const id = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  const isSupport =
    user.role === "MASTER" ||
    user.role === "ADMIN" ||
    user.baseRole === "MASTER" ||
    user.baseRole === "ADMIN" ||
    user.isAdmin;

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/me/support/${id}`, { credentials: "include" })
      .then((r) => r.json() as Promise<ApiResponse<{ ticket: Ticket }>>)
      .then((json) => {
        if (json?.ok && json.data?.ticket) setTicket(json.data.ticket);
        else setTicket(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!ticket || isSupport) return;
    fetch(`/api/me/support/${id}/read`, { method: "PATCH", credentials: "include" })
      .catch(() => {})
      .finally(() => {
        window.dispatchEvent(new CustomEvent("support-badge-refetch"));
      });
  }, [id, ticket, isSupport]);

  useEffect(() => {
    if (ticket && isSupport) {
      window.dispatchEvent(new CustomEvent("support-badge-refetch"));
    }
  }, [ticket, isSupport]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/me/support/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: reply.trim() }),
      });
      const json = (await res.json()) as ApiResponse<{ message: Message }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro" : "Falha ao enviar.");
        return;
      }
      toast.push("success", "Mensagem enviada.");
      setReply("");
      load();
    } finally {
      setSending(false);
    }
  }

  async function closeTicket() {
    if (!ticket || ticket.status === "CLOSED" || closing) return;
    if (!confirm("Encerrar este chamado? Não será possível enviar novas mensagens após encerrar.")) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/me/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "CLOSED" }),
      });
      const json = (await res.json()) as ApiResponse<{ status: string }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? (json as { error?: { message?: string } }).error?.message ?? "Erro ao encerrar." : "Erro ao encerrar.");
        return;
      }
      toast.push("success", "Chamado encerrado.");
      load();
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-w-0">
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-12 text-center text-[var(--text-muted)]">
          Carregando…
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-w-0">
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-12 text-center">
          <p className="text-[var(--text-muted)]">Chamado não encontrado.</p>
          <Link
            href="/suporte"
            className="mt-3 inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 hover:brightness-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:brightness-95"
          >
            Ver meus chamados
          </Link>
        </div>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    OPEN: "Aberto",
    ANSWERED: "Respondido",
    CLOSED: "Encerrado",
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <Link href="/suporte" className="text-sm text-[var(--igh-primary)] hover:underline">
          ← Voltar aos chamados
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-[var(--igh-primary)] sm:text-xl">
              {ticket.protocolNumber}
            </h1>
            <span className="rounded-full bg-[var(--igh-surface)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              {statusLabel[ticket.status] ?? ticket.status}
            </span>
          </div>
          {ticket.status !== "CLOSED" && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={closeTicket}
              disabled={closing}
            >
              {closing ? "Encerrando…" : "Encerrar chamado"}
            </Button>
          )}
        </div>
        <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{ticket.subject}</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{ticket.summary}</p>
        {ticket.attachmentUrls && ticket.attachmentUrls.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-[var(--text-muted)]">Anexos</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {ticket.attachmentUrls.map((url, idx) => {
                const isImage = url.includes("/image/upload/");
                const name = ticket.attachmentNames?.[idx] ?? url;
                return (
                  <li key={`${url}-${idx}`}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--card-bg)]"
                    >
                      {isImage ? (
                        <img src={url} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                      ) : (
                        <span aria-hidden>📎</span>
                      )}
                      <span className="max-w-[180px] truncate">{name || "Anexo"}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </header>

      <div className="card">
        <div className="card-header">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Mensagens</h3>
        </div>
        <div className="card-body space-y-4">
          {ticket.messages.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhuma mensagem ainda. O suporte responderá em breve.</p>
          ) : (
            ticket.messages.map((msg) => {
              const isFromMe =
                (isSupport && msg.isFromSupport) || (!isSupport && !msg.isFromSupport);
              const authorLabel = isFromMe
                ? "Você"
                : msg.isFromSupport
                  ? "Suporte"
                  : ticket.user?.name ?? "Aluno";
              return (
                <div
                  key={msg.id}
                  className={`rounded-lg border p-3 ${
                    msg.isFromSupport
                      ? "border-[var(--igh-primary)] bg-[var(--igh-surface)]"
                      : "border-[var(--card-border)] bg-[var(--card-bg)]"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--text-muted)]">
                      {authorLabel}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(msg.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{msg.content}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {ticket.status === "CLOSED" ? (
        <div className="card max-w-2xl border-[var(--card-border)] bg-[var(--igh-surface)]">
          <div className="card-body">
            <p className="text-sm text-[var(--text-muted)]">
              Este chamado foi encerrado. Para nova dúvida, abra um novo chamado em Suporte.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={sendReply} className="card max-w-2xl">
          <div className="card-header">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {isSupport ? "Responder como suporte" : "Enviar mensagem"}
            </h3>
          </div>
          <div className="card-body flex flex-col gap-3">
            <textarea
              className="min-h-[100px] w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus:border-[var(--igh-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={isSupport ? "Digite a resposta do suporte…" : "Digite sua mensagem…"}
              required
            />
            <Button type="submit" disabled={sending || !reply.trim()}>
              {sending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
