"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type Ticket = {
  id: string;
  protocolNumber: string;
  subject: string;
  summary: string;
  status: string;
  hasUnread?: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { name: string; email: string };
  lastMessage?: { content: string; createdAt: string } | null;
};

export default function SuportePage() {
  const user = useUser();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);

  const isSupport = user.role === "MASTER" || user.role === "ADMIN";
  const apiUrl = isSupport ? "/api/admin/support" : "/api/me/support";

  useEffect(() => {
    fetch(apiUrl, { credentials: "include" })
      .then((r) => r.json() as Promise<ApiResponse<{ tickets: Ticket[] }>>)
      .then((json) => {
        if (json?.ok && json.data?.tickets) setTickets(json.data.tickets);
      })
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const statusLabel: Record<string, string> = {
    OPEN: "Aberto",
    ANSWERED: "Respondido",
    CLOSED: "Encerrado",
  };

  const visibleTickets = tickets.filter((t) =>
    showClosed ? true : t.status !== "CLOSED"
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            Suporte técnico
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {isSupport ? "Atendimento aos chamados dos alunos." : "Acompanhe seus chamados ou abra um novo para entrar em contato com o suporte."}
          </p>
        </div>
        {user.role === "STUDENT" && (
          <Link
            href="/suporte/novo"
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 hover:brightness-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:brightness-95"
          >
            Novo chamado
          </Link>
        )}
      </header>

      {loading ? (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          Carregando…
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            {isSupport ? "Nenhum chamado no momento." : "Você ainda não abriu nenhum chamado."}
          </p>
          {user.role === "STUDENT" && (
            <Link
              href="/suporte/novo"
              className="mt-3 inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-zinc-800 hover:brightness-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:brightness-95"
            >
              Abrir primeiro chamado
            </Link>
          )}
        </div>
      ) : (
        <>
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowClosed((v) => !v)}
          >
            {showClosed ? "Ocultar chamados encerrados" : "Exibir chamados encerrados"}
          </Button>
        </div>
        {visibleTickets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--igh-surface)] px-4 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              {showClosed
                ? "Nenhum chamado encontrado."
                : "Nenhum chamado em aberto ou aguardando resposta."}
            </p>
          </div>
        ) : (
        <ul className="list-none space-y-3 pl-0">
          {visibleTickets.map((t) => {
            const isAwaitingResponse = t.status === "OPEN";
            return (
            <li key={t.id}>
              <Link
                href={`/suporte/${t.id}`}
                className={`block rounded-lg border p-4 transition hover:border-[var(--igh-primary)] hover:bg-[var(--igh-surface)] ${
                  isAwaitingResponse
                    ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
                    : "border-[var(--card-border)] bg-[var(--card-bg)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-[var(--igh-primary)]">
                    {t.protocolNumber}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {statusLabel[t.status] ?? t.status}
                    {!isSupport && t.hasUnread && (
                      <span className="ml-2 text-green-600 dark:text-green-400">— Nova resposta</span>
                    )}
                  </span>
                </div>
                <h2 className="mt-1 font-medium text-[var(--text-primary)]">{t.subject}</h2>
                {t.user && (
                  <p className="text-xs text-[var(--text-muted)]">{t.user.name} — {t.user.email}</p>
                )}
                <p className="mt-0.5 line-clamp-2 text-sm text-[var(--text-muted)]">
                  {t.lastMessage?.content ?? t.summary}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {t.lastMessage?.createdAt
                    ? `Última mensagem em ${new Date(t.lastMessage.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                    : `Atualizado em ${new Date(t.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                </p>
              </Link>
            </li>
            );
          })}
        </ul>
        )}
        </>
      )}
    </div>
  );
}
